package pe.pucp.tasfb2b.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsFlightPlan;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.repository.OpsFlightPlanRepository;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lógica de cancelación puntual de vuelos.
 *
 * Cancela la instancia concreta de OPS_FLIGHT que corresponde a la regla:
 *   - Si faltan >= 60 min para la salida del vuelo de HOY  → cancela HOY
 *   - Si faltan <  60 min, o el vuelo de hoy ya pasó       → cancela MAÑANA
 *
 * No toca OPS_FLIGHT_PLAN (el plan sigue activo; mañana el planificador
 * genera la siguiente instancia normalmente).
 *
 * Efecto colateral: los envíos PLANNED asignados al vuelo cancelado
 * regresan a PENDING para que el siguiente ciclo de 6h los replanifique.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsFlightCancelService {

    /** Minutos de antelación mínima para cancelar el vuelo del mismo día. */
    private static final long CANCEL_CUTOFF_MINUTES = 60L;

    private final OpsFlightPlanRepository    flightPlanRepo;
    private final OpsFlightRepository        flightRepo;
    private final OpsShipmentRepository      shipmentRepo;
    private final OpsShipmentRouteRepository routeRepo;

    // ── DTO de resultado ──────────────────────────────────────────────────────

    public enum CancelResultType { OK, ALREADY_CANCELLED, NOT_CANCELLABLE }

    public record CancelResult(
            CancelResultType type,
            LocalDate        targetDate,
            int              shipmentsReleased,
            String           message
    ) {
        static CancelResult ok(LocalDate date, int released) {
            return new CancelResult(CancelResultType.OK, date, released,
                    "Vuelo cancelado para " + date + ". " + released + " envío(s) liberados.");
        }
        static CancelResult alreadyCancelled(LocalDate date) {
            return new CancelResult(CancelResultType.ALREADY_CANCELLED, date, 0,
                    "El vuelo del " + date + " ya estaba cancelado.");
        }
        static CancelResult notCancellable(String status) {
            return new CancelResult(CancelResultType.NOT_CANCELLABLE, null, 0,
                    "No se puede cancelar un vuelo en estado: " + status);
        }
    }

    // ── Cancelación desde el panel de Operaciones (mapa) ─────────────────────
    //
    // El mapa muestra instancias concretas (OPS_FLIGHT), no planes. Resolvemos
    // el plan dueño de la instancia y delegamos en cancelByPlanId para no
    // duplicar la regla de 60 min ni la liberación de envíos.

    @Transactional
    public CancelResult cancelByFlightInstanceId(Long flightInstanceId) {
        OpsFlight flight = flightRepo.findById(flightInstanceId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Vuelo no encontrado: " + flightInstanceId));

        Long planId = flight.getFlightPlan().getId();
        return cancelByPlanId(planId);
    }

    // ── Método principal ──────────────────────────────────────────────────────

    @Transactional
    public CancelResult cancelByPlanId(Long flightPlanId) {
        OpsFlightPlan plan = flightPlanRepo.findById(flightPlanId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Plan de vuelo no encontrado: " + flightPlanId));

        LocalDateTime now        = LocalDateTime.now(ZoneOffset.UTC);
        LocalDate     targetDate = resolveTargetDate(plan, now);

        // Buscar la instancia concreta; si no existe aún (planificador no corrió
        // para ese día), la creamos aquí mismo para poder cancelarla de inmediato.
        OpsFlight flight = flightRepo
                .findByFlightPlanIdAndFlightDate(flightPlanId, targetDate)
                .orElseGet(() -> createFlightInstance(plan, targetDate));

        if ("CANCELLED".equals(flight.getStatus())) {
            return CancelResult.alreadyCancelled(targetDate);
        }
        if ("IN_FLIGHT".equals(flight.getStatus()) || "LANDED".equals(flight.getStatus())) {
            return CancelResult.notCancellable(flight.getStatus());
        }

        // Cancelar la instancia
        flight.setStatus("CANCELLED");
        flight.setCancelReason("Cancelación manual — " + now);
        flightRepo.save(flight);

        // Liberar envíos asignados → regresan a PENDING
        int released = releaseShipments(flight, now);

        log.info("OpsFlightCancelService: plan={} fecha={} CANCELADO — {} envío(s) liberados",
                flightPlanId, targetDate, released);

        return CancelResult.ok(targetDate, released);
    }

    // ── Regla de negocio: ¿qué fecha cancela? ────────────────────────────────

    /**
     * depTimeLocal del plan está almacenado como UTC (igual que en OpsPlannerService).
     * Calculamos cuántos minutos faltan para la salida del vuelo de HOY:
     *   >= 60 min → cancela hoy
     *   <  60 min (o ya pasó, lo que da negativo) → cancela mañana
     */
    private LocalDate resolveTargetDate(OpsFlightPlan plan, LocalDateTime now) {
        LocalDate     today    = now.toLocalDate();
        LocalDateTime todayDep = LocalDateTime.of(today, plan.getDepTimeLocal());
        long minutesUntilDep   = Duration.between(now, todayDep).toMinutes();

        if (minutesUntilDep >= CANCEL_CUTOFF_MINUTES) {
            return today;          // más de 1h de antelación → cancela HOY
        } else {
            return today.plusDays(1); // menos de 1h o ya pasó → cancela MAÑANA
        }
    }

    // ── Liberar envíos PLANNED del vuelo cancelado ────────────────────────────

    private int releaseShipments(OpsFlight flight, LocalDateTime now) {
        List<OpsShipmentRoute> routes = routeRepo.findAllByFlightId(flight.getId());
        if (routes.isEmpty()) return 0;

        Set<Long> shipmentIds = routes.stream()
                .map(r -> r.getShipment().getId())
                .collect(Collectors.toSet());

        // Borrar las rutas del vuelo cancelado
        routeRepo.deleteAll(routes);

        // Regresar los envíos a PENDING para el siguiente ciclo del planificador
        List<OpsShipment> shipments = shipmentRepo.findAllById(shipmentIds);
        shipments.forEach(s -> {
            s.setStatus("PENDING");
            s.setLastUpdated(now);
        });
        shipmentRepo.saveAll(shipments);

        return shipments.size();
    }

    // ── Crear instancia si el planificador aún no la generó ──────────────────

    /**
     * Replica exactamente la lógica de OpsPlannerService.generateFlightInstances()
     * para crear la instancia del día correcto cuando aún no existe en BD.
     */
    private OpsFlight createFlightInstance(OpsFlightPlan plan, LocalDate date) {
        OpsFlight f = new OpsFlight();
        f.setFlightPlan(plan);
        f.setFlightDate(date);
        f.setOriginIata(plan.getOriginIata());
        f.setDestIata(plan.getDestIata());
        f.setCapacity(plan.getCapacity());
        f.setStatus("SCHEDULED");
        f.setDepTimeUtc(LocalDateTime.of(date, plan.getDepTimeLocal()));
        LocalDateTime arr = LocalDateTime.of(date, plan.getArrTimeLocal());
        if (arr.isBefore(f.getDepTimeUtc())) arr = arr.plusDays(1); // vuelo nocturno
        f.setArrTimeUtc(arr);
        return flightRepo.save(f);
    }
}