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
import pe.pucp.tasfb2b.repository.*;

import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlannerService {

    private final AlnsEngine alnsEngine;
    private final RouteRepository routeRepo;
    private final RouteLegRepository routeLegRepo;
    private final ShipmentRepository shipmentRepo;

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

    @Transactional
    public void persistRoutes(OptimizationResult result) {
        for (Route route : result.routes()) {
            Shipment shipment = route.getShipment();
            shipment.setStatus(ShipmentStatus.PLANNED);

            BaggageBatch batch = shipment.getBaggageBatch();
            boolean sameContinent = batch.isSameContinent();
            shipment.setDeadline(batch.getAvailableFrom()
                    .plus(sameContinent ? 1 : 2, ChronoUnit.DAYS));

            Shipment saved = shipmentRepo.save(shipment);
            route.setShipment(saved);

            Route savedRoute = routeRepo.save(route);

            for (RouteLeg leg : route.getLegs()) {
                leg.setRoute(savedRoute);
                routeLegRepo.save(leg);
            }
        }
    }

    private RouteOptimizer selectOptimizer(String algorithm) {
        return alnsEngine;
    }
}
