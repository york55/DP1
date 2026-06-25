package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Dispara la sincronización de estados de vuelo (SCHEDULED → IN_FLIGHT → LANDED)
 * con una frecuencia mucho mayor a la del ciclo de planificación, ya que aquí
 * solo se compara la hora actual contra dep/arr time — no hay cómputo pesado.
 *
 * Requiere @EnableScheduling en la clase principal (ya activado por
 * OpsPlannerScheduler).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OpsFlightStatusScheduler {

    private final OpsFlightStatusService statusService;

    /** Corre cada 10 minutos. */
    @Scheduled(fixedDelay = 10 * 60 * 1000L, initialDelay = 10 * 60 * 1000L)
    public void scheduledStatusSync() {
        try {
            statusService.syncFlightStatuses();
        } catch (Exception e) {
            log.error("OpsFlightStatusScheduler: error sincronizando estados de vuelo", e);
        }
    }
}
