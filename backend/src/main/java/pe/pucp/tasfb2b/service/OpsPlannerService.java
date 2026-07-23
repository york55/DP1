package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsFlightPlan;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.planner.OpsAlnsEngine;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.OpsFlightPlanRepository;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Orquesta el ciclo de planificación de operaciones reales:
 *   1. Genera instancias OPS_FLIGHT para los próximos días si aún no existen.
 *   2. Carga los envíos PENDING.
 *   3. Ejecuta el ALNS.
 *   4. Persiste las rutas y marca los envíos como PLANNED.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsPlannerService {

    /** Ventana de vuelos que se generan hacia adelante (en días). */
    private static final int FLIGHT_WINDOW_DAYS = 2;

    private final OpsFlightPlanRepository  flightPlanRepo;
    private final OpsFlightRepository      flightRepo;
    private final OpsShipmentRepository    shipmentRepo;
    private final OpsShipmentRouteRepository routeRepo;
    private final OpsAlnsEngine            alnsEngine;

    @Transactional
    public void runPlanning() {
        log.info("OpsPlannerService: iniciando ciclo de planificación");

        // 1 ── Generar instancias de vuelo para la ventana ──────────────────────
        List<OpsFlight> flights = generateFlightInstances();
        if (flights.isEmpty()) {
            log.warn("OpsPlannerService: no hay vuelos disponibles en la ventana, abortando.");
            return;
        }

        // 2 ── Cargar envíos pendientes ─────────────────────────────────────────
        List<OpsShipment> pending = shipmentRepo.findAllByStatus("PENDING");
        if (pending.isEmpty()) {
            log.info("OpsPlannerService: no hay envíos PENDING, nada que planificar.");
            return;
        }
        log.info("OpsPlannerService: {} envíos pendientes, {} vuelos disponibles",
                pending.size(), flights.size());

        // 3 ── Limpiar rutas previas de los envíos que se van a replanificar ────
        // Blindaje (2b del diagnóstico): excluye tramos ligados a un vuelo
        // IN_FLIGHT. No debería llegar a pasar (Problema 1 + 2a ya evitan que
        // un envío llegue a PENDING con un tramo real en vuelo), pero si pasa,
        // borrar esa ruta la dejaría huérfana al aterrizar.
        pending.forEach(s -> routeRepo.deleteAllByShipmentIdExceptInFlight(s.getId()));

        // 4 ── Ejecutar ALNS ────────────────────────────────────────────────────
        AlnsParams params = AlnsParams.defaults();
        List<OpsShipmentRoute> routes = alnsEngine.optimize(pending, flights, params);

        // 5 ── Persistir rutas y actualizar estados ─────────────────────────────
        persistResults(routes, pending);

        log.info("OpsPlannerService: ciclo completado — {} rutas persistidas, {} sin asignar",
                routes.size(),
                pending.size() - countAssigned(routes, pending));
    }

    // ── Generación de instancias de vuelo ─────────────────────────────────────

    /**
     * Para cada plan activo crea un OPS_FLIGHT por cada día dentro de la ventana,
     * si aún no existe (constraint uk_flight_plan_date lo garantiza en BD también).
     * Los tiempos locales del plan se tratan como UTC directamente porque los
     * horarios en OPS_FLIGHT_PLAN ya están expresados en UTC.
     */
    private List<OpsFlight> generateFlightInstances() {
        List<OpsFlightPlan> plans = flightPlanRepo.findAllByIsActiveTrue();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        for (OpsFlightPlan plan : plans) {
            for (int d = 0; d <= FLIGHT_WINDOW_DAYS; d++) {
                LocalDate date = today.plusDays(d);
                boolean exists = flightRepo.findByFlightPlanIdAndFlightDate(plan.getId(), date).isPresent();
                if (exists) continue;

                OpsFlight flight = new OpsFlight();
                flight.setFlightPlan(plan);
                flight.setFlightDate(date);
                flight.setOriginIata(plan.getOriginIata());
                flight.setDestIata(plan.getDestIata());
                flight.setCapacity(plan.getCapacity());
                flight.setStatus("SCHEDULED");

                // Combinamos fecha con el time del plan (interpretado como UTC)
                flight.setDepTimeUtc(LocalDateTime.of(date, plan.getDepTimeLocal()));
                LocalDateTime arr = LocalDateTime.of(date, plan.getArrTimeLocal());
                // Si la hora de llegada es anterior a la de salida, el vuelo cruza la medianoche
                if (arr.isBefore(flight.getDepTimeUtc())) arr = arr.plusDays(1);
                flight.setArrTimeUtc(arr);

                flightRepo.save(flight);
            }
        }

        // Retorna todos los vuelos SCHEDULED en la ventana
        LocalDateTime windowStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay();
        LocalDateTime windowEnd   = windowStart.plusDays(FLIGHT_WINDOW_DAYS + 1);
        return flightRepo.findScheduledInWindow(windowStart, windowEnd);
    }

    // ── Persistencia de resultados ─────────────────────────────────────────────

    private void persistResults(List<OpsShipmentRoute> routes, List<OpsShipment> allPending) {
        // Guardar rutas
        routeRepo.saveAll(routes);

        // Marcar como PLANNED los envíos que obtuvieron al menos un tramo
        java.util.Set<Long> assignedIds = new java.util.HashSet<>();
        routes.forEach(r -> assignedIds.add(r.getShipment().getId()));

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        allPending.forEach(s -> {
            if (assignedIds.contains(s.getId())) {
                s.setStatus("PLANNED");
            }
            // Los que no tienen ruta quedan PENDING para el siguiente ciclo
            s.setLastUpdated(now);
        });
        shipmentRepo.saveAll(allPending);
    }

    private long countAssigned(List<OpsShipmentRoute> routes, List<OpsShipment> pending) {
        java.util.Set<Long> ids = new java.util.HashSet<>();
        routes.forEach(r -> ids.add(r.getShipment().getId()));
        return ids.size();
    }
}