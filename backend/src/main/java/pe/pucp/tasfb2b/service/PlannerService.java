package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
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

        // Guardar todos los shipments en un solo batch
        List<Shipment> shipments = result.routes().stream()
                .map(Route::getShipment)
                .peek(s -> s.setStatus(ShipmentStatus.PLANNED))
                .collect(Collectors.toList());
        List<Shipment> savedShipments = shipmentRepo.saveAll(shipments);

        // Asociar shipments guardados a sus routes
        List<Route> routes = result.routes();
        for (int i = 0; i < routes.size(); i++) {
            routes.get(i).setShipment(savedShipments.get(i));
        }

        // Guardar todas las routes en un solo batch
        List<Route> savedRoutes = routeRepo.saveAll(routes);

        // Recopilar y guardar todos los legs en un solo batch
        List<RouteLeg> allLegs = new ArrayList<>();
        for (Route savedRoute : savedRoutes) {
            for (RouteLeg leg : savedRoute.getLegs()) {
                leg.setRoute(savedRoute);
                allLegs.add(leg);
            }
        }
        routeLegRepo.saveAll(allLegs);
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