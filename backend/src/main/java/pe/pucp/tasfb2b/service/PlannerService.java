package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
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
import java.util.stream.Collectors;

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

    // Antes hardcodeados en AlnsParams.defaults() (w4=0.05 / w5=0.35). Se exponen para
    // poder subir w4 (consolidación/utilización de vuelos) sin recompilar. w4 sube un poco
    // el default respecto al hardcode anterior — es la opción "rápida / bajo riesgo": ayuda
    // algo al fill rate, pero el operador que realmente decide en qué vuelo va cada lote
    // (RegretKInsertion) es lexicográfico y no mira utilización, así que el efecto real es
    // acotado. La mejora de fondo (desempate por "vuelo más lleno" entre candidatos puntuales
    // empatados en RegretKInsertion) sigue pendiente si se quiere más impacto.
    @Value("${tasf.alns.default-w4:0.10}")
    private double defaultW4;

    @Value("${tasf.alns.default-w5:0.35}")
    private double defaultW5;

    private final AlnsEngine alnsEngine;
    private final RouteRepository routeRepo;
    private final RouteLegRepository routeLegRepo;
    private final ShipmentRepository shipmentRepo;
    private final BaggageBatchRepository batchRepo;

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
        // IMPORTANT: this must run even when result.routes() is empty — a replan() call
        // where every affected batch failed to find a feasible route (all banked) used to
        // return here early and silently leave those batches with whatever stale legs a
        // previous plan had assigned them (e.g. the CANCELLED leg from the flight that
        // triggered this replan, plus later PENDING legs pointing at flights/airports the
        // batch never actually reached). That's what produced shipments showing as
        // IN_TRANSIT "on" a flight that was never really theirs.
        if (!result.bankedBatchIds().isEmpty()) {
            cleanUpUnroutedBatches(result.bankedBatchIds());
        }

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

    /**
     * Handles batches the ALNS could not fit into any feasible route (the "bank").
     * These never produce a {@link Route} in {@link OptimizationResult#routes()}, so
     * without this step they'd keep whatever route/legs they had before this replan —
     * typically a leg already marked CANCELLED (from the flight that triggered the
     * replan) plus, on multi-leg routes, one or more later legs still PENDING that
     * assumed the batch would reach an intermediate airport it never actually reached.
     * That stale PENDING leg is exactly what made a shipment look "in transit" toward a
     * flight it had no real business being on.
     * <p>
     * Fix: delete those now-meaningless PENDING legs (COMPLETED legs are kept as
     * historical record, same rule persistRoutes already applies) and flag the batch as
     * DELAYED so it's visibly stuck instead of silently pointing at a stale plan. DELAYED
     * is reused rather than adding a new status: it already means "known issue, not
     * currently following a valid route" (see SimulationEngine#checkSlaViolations), and
     * anything already DELIVERED is left untouched.
     */
    private void cleanUpUnroutedBatches(List<Long> bankedBatchIds) {
        for (Long batchId : bankedBatchIds) {
            Optional<Shipment> existingShipment = shipmentRepo.findByBaggageBatchId(batchId);
            if (existingShipment.isEmpty()) {
                // Never had a route to begin with (e.g. failed on its very first planning
                // pass) — nothing stale to clean up, just make sure it's visible in logs.
                log.warn("Lote {} no pudo ser ruteado por el ALNS y no tiene ruta previa.", batchId);
                continue;
            }

            Shipment shipment = existingShipment.get();
            if (shipment.getStatus() == ShipmentStatus.DELIVERED) continue;

            Optional<Route> existingRoute = routeRepo.findByShipmentId(shipment.getId());
            if (existingRoute.isPresent()) {
                List<RouteLeg> staleLegs = routeLegRepo.findByRouteIdOrderByLegOrder(existingRoute.get().getId())
                        .stream()
                        .filter(leg -> leg.getStatus() == RouteLegStatus.PENDING)
                        .collect(Collectors.toList());
                if (!staleLegs.isEmpty()) {
                    routeLegRepo.deleteAll(staleLegs);
                }
            }

            shipment.setStatus(ShipmentStatus.DELAYED);
            shipmentRepo.save(shipment);

            BaggageBatch batch = shipment.getBaggageBatch();
            if (batch != null) {
                batch.setStatus(BatchStatus.DELAYED);
                batchRepo.save(batch);
            }

            log.warn("Lote {} quedó sin ruta factible tras una replanificación (banco ALNS). " +
                            "Se eliminaron sus tramos PENDING obsoletos y se marcó como DELAYED.",
                    batchId);
        }
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
                defaultW4, defaultW5, defaults.kRegret(), defaults.connectMinGapMinutes(),
                defaults.maxHops()
        );
    }

    private RouteOptimizer selectOptimizer(String algorithm) {
        return alnsEngine;
    }
}