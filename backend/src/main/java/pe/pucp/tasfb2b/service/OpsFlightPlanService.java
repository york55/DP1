package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsFlightPlan;
import pe.pucp.tasfb2b.dto.response.ActiveFlightResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsFlightPlanRepository;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpsFlightPlanService {

    private final OpsFlightPlanRepository flightRepo;
    private final OpsAirportRepository    airportRepo;
    private final OpsFlightRepository     flightInstanceRepo; // ── AGREGADO

    // ── AGREGADO: delega la cancelación al nuevo servicio ────────────────────
    private final OpsFlightCancelService cancelService;

    private static final long CANCEL_CUTOFF_MINUTES = 60L;

    public List<ActiveFlightResponse> getAllFlights() {
        Map<String, Integer> offsets = airportRepo.findAllAirports().stream()
            .collect(Collectors.toMap(OpsAirport::getIataCode, OpsAirport::getGmtOffset));

        List<OpsFlightPlan> raw = flightRepo.findAllOrderByDeparture();
        log.info("Vuelos encontrados en BD: {}", raw.size());

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        return raw.stream()
            .map(f -> toResponse(f, offsets, now))
            .toList();
    }

    @Transactional
    public boolean cancelFlight(Long id) {
        OpsFlightCancelService.CancelResult result = cancelService.cancelByPlanId(id);
        log.info("cancelFlight plan={} → {} : {}", id, result.type(), result.message());
        return result.type() == OpsFlightCancelService.CancelResultType.OK;
    }

    private ActiveFlightResponse toResponse(OpsFlightPlan f, Map<String, Integer> offsets,
                                            LocalDateTime now) {
        int originOffset = offsets.getOrDefault(f.getOriginIata(), 0);
        int destOffset   = offsets.getOrDefault(f.getDestIata(),   0);

        LocalTime depUtc = f.getDepTimeLocal().minusHours(originOffset);
        LocalTime arrUtc = f.getArrTimeLocal().minusHours(destOffset);

        // ── AGREGADO: calcular qué fecha cancelaría ahora y si ya está cancelada
        boolean nextInstanceCancelled = isNextInstanceCancelled(f, now);

        return new ActiveFlightResponse(
            f.getId(),
            f.getOriginIata(),
            f.getDestIata(),
            depUtc.toString(),
            arrUtc.toString(),
            f.getDepTimeLocal().toString(),
            f.getArrTimeLocal().toString(),
            f.getCapacity(),
            !f.getIsActive(),
            nextInstanceCancelled
        );
    }

    /**
     * Aplica la misma regla de 1h que OpsFlightCancelService.resolveTargetDate()
     * para saber qué instancia concreta aplicaría si se cancelara ahora,
     * y devuelve true si esa instancia ya existe con status CANCELLED.
     */
    private boolean isNextInstanceCancelled(OpsFlightPlan plan, LocalDateTime now) {
        LocalDate today          = now.toLocalDate();
        LocalDateTime todayDep   = LocalDateTime.of(today, plan.getDepTimeLocal());
        long minutesUntilDep     = Duration.between(now, todayDep).toMinutes();

        LocalDate targetDate = minutesUntilDep >= CANCEL_CUTOFF_MINUTES
                ? today
                : today.plusDays(1);

        Optional<OpsFlight> instance =
                flightInstanceRepo.findByFlightPlanIdAndFlightDate(plan.getId(), targetDate);

        return instance.map(f -> "CANCELLED".equals(f.getStatus())).orElse(false);
    }
}