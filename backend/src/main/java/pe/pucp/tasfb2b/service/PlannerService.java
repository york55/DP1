package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.RouteLegStatus;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.exception.PlanningException;
import pe.pucp.tasfb2b.planner.OptimizationResult;
import pe.pucp.tasfb2b.planner.RouteOptimizer;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.AlnsEngine;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlannerService {

    @Value("${tasf.alns.default-t0:100.0}")
    private double defaultT0;

    @Value("${tasf.alns.default-alpha:0.9995}")
    private double defaultAlpha;

    @Value("${tasf.alns.default-q-pct:0.25}")
    private double defaultQPct;

    @Value("${tasf.alns.default-max-iterations:80}")
    private int defaultMaxIterations;

    @Value("${tasf.alns.default-seg-len:20}")
    private int defaultSegLen;

    private final AlnsEngine alnsEngine;
    private final RouteRepository routeRepo;
    private final RouteLegRepository routeLegRepo;
    private final ShipmentRepository shipmentRepo;

    @Transactional
    public OptimizationResult plan(SimulationContext context, String algorithm) {
        RouteOptimizer optimizer = selectOptimizer(algorithm);
        log.info("Iniciando planificación con {}: {} lotes pendientes",
                optimizer.algorithmName(), context.getPendingBatches().size());
        try {
            OptimizationResult result = optimizer.optimize(context);
            persistRoutes(result);
            return result;
        } catch (Exception e) {
            throw new PlanningException("Error durante planificación: " + e.getMessage(), e);
        }
    }

    @Transactional
    public OptimizationResult replan(List<BaggageBatch> affected, SimulationContext context,
                                      String algorithm) {
        RouteOptimizer optimizer = selectOptimizer(algorithm);
        log.info("Replanificando {} lotes con {}", affected.size(), optimizer.algorithmName());
        try {
            OptimizationResult result = optimizer.replan(affected, context);
            persistRoutes(result);
            return result;
        } catch (Exception e) {
            log.error("Error en replanificación: {}", e.getMessage(), e);
            return null;
        }
    }

    public void persistRoutes(OptimizationResult result) {
        if (result.routes().isEmpty()) return;

        // AlnsEngine always hands us transient Shipment/Route objects (buildRoutes()
        // does `new Shipment()` / `new Route()` for every batch it routes). That's correct
        // the first time a batch is planned, but replan() is only ever invoked for batches
        // that already have a Shipment (see SimulationEngine.cancelFlightAndReplan /
        // checkSlaViolations) — baggage_batch_id is unique on shipments and shipment_id is
        // unique on routes, so blindly inserting would collide. Reuse the existing
        // Shipment/Route when present instead of inserting a duplicate.
        List<Shipment> shipmentsToSave = new ArrayList<>();
        List<Route> routesToSave = new ArrayList<>();
        List<RouteLeg> legsToSave = new ArrayList<>();
        List<RouteLeg> legsToDelete = new ArrayList<>();

        for (Route plannedRoute : result.routes()) {
            Shipment plannedShipment = plannedRoute.getShipment();
            BaggageBatch batch = plannedShipment.getBaggageBatch();

            Optional<Shipment> existingShipment = shipmentRepo.findByBaggageBatchId(batch.getId());
            Shipment shipment = existingShipment.orElse(plannedShipment);
            shipment.setBaggageBatch(batch);
            shipment.setDeadline(plannedShipment.getDeadline());

            // Reuse the existing route too, and only supersede the portion of it that
            // hasn't flown yet — legs already COMPLETED are historical record and must
            // not be deleted just because a later leg got cancelled/delayed and the batch
            // is being re-routed from its current position onward.
            Route route = plannedRoute;
            int legOrderOffset = 0;
            if (existingShipment.isPresent()) {
                Optional<Route> existingRoute = routeRepo.findByShipmentId(existingShipment.get().getId());
                if (existingRoute.isPresent()) {
                    route = existingRoute.get();
                    List<RouteLeg> oldLegs = routeLegRepo.findByRouteIdOrderByLegOrder(route.getId());
                    for (RouteLeg oldLeg : oldLegs) {
                        if (oldLeg.getStatus() == RouteLegStatus.COMPLETED) {
                            legOrderOffset++;
                        } else {
                            legsToDelete.add(oldLeg);
                        }
                    }
                }
            }

            if (shipment.getStatus() != ShipmentStatus.DELIVERED) {
                shipment.setStatus(legOrderOffset > 0 ? ShipmentStatus.IN_TRANSIT : ShipmentStatus.PLANNED);
            }

            route.setShipment(shipment);
            route.setAlgorithmUsed(plannedRoute.getAlgorithmUsed());
            route.setEstimatedArrival(plannedRoute.getEstimatedArrival());
            route.setTotalLegs(legOrderOffset + plannedRoute.getLegs().size());

            for (RouteLeg leg : plannedRoute.getLegs()) {
                leg.setLegOrder(leg.getLegOrder() + legOrderOffset);
                leg.setRoute(route);
                legsToSave.add(leg);
            }

            shipmentsToSave.add(shipment);
            routesToSave.add(route);
        }

        if (!legsToDelete.isEmpty()) {
            routeLegRepo.deleteAll(legsToDelete);
        }
        shipmentRepo.saveAll(shipmentsToSave);
        routeRepo.saveAll(routesToSave);
        routeLegRepo.saveAll(legsToSave);
    }

    public AlnsParams buildAlnsParams(Simulation sim) {
        AlnsParams defaults = AlnsParams.defaults();
        return new AlnsParams(
                sim.getT0() != null ? sim.getT0() : defaultT0,
                sim.getAlphaSa() != null ? sim.getAlphaSa() : defaultAlpha,
                sim.getQPct() != null ? sim.getQPct() : defaultQPct,
                sim.getMaxIterations() != null ? sim.getMaxIterations() : defaultMaxIterations,
                defaultSegLen, defaults.sigma1(), defaults.sigma2(), defaults.sigma3(),
                defaults.rho(), defaults.pNoise(), defaults.w1(), defaults.w2(), defaults.w3(),
                defaults.w4(), defaults.w5(), defaults.kRegret(), defaults.connectMinGapMinutes(),
                defaults.maxHops()
        );
    }

    private RouteOptimizer selectOptimizer(String algorithm) {
        return alnsEngine;
    }
}