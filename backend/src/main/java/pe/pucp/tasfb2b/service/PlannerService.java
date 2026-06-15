package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlannerService {

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
        for (Route route : result.routes()) {
            Shipment shipment = route.getShipment();
            shipment.setStatus(ShipmentStatus.PLANNED);

            Shipment saved = shipmentRepo.save(shipment);
            route.setShipment(saved);

            Route savedRoute = routeRepo.save(route);

            for (RouteLeg leg : route.getLegs()) {
                leg.setRoute(savedRoute);
                routeLegRepo.save(leg);
            }
        }
    }

    public AlnsParams buildAlnsParams(Simulation sim) {
        AlnsParams defaults = AlnsParams.defaults();
        return new AlnsParams(
                sim.getT0() != null ? sim.getT0() : defaults.t0(),
                sim.getAlphaSa() != null ? sim.getAlphaSa() : defaults.alpha(),
                sim.getQPct() != null ? sim.getQPct() : defaults.qPct(),
                sim.getMaxIterations() != null ? sim.getMaxIterations() : defaults.maxIterations(),
                defaults.segLen(), defaults.sigma1(), defaults.sigma2(), defaults.sigma3(),
                defaults.rho(), defaults.pNoise(), defaults.w1(), defaults.w2(), defaults.w3(),
                defaults.kRegret()
        );
    }

    private RouteOptimizer selectOptimizer(String algorithm) {
        return alnsEngine;
    }
}
