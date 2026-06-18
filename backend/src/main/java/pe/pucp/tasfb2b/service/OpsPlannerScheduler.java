package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Dispara el ciclo de planificación OPS cada 6 horas.
 * Para habilitar el scheduler asegúrate de que la clase principal
 * (TasfB2bApplication) tenga @EnableScheduling.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OpsPlannerScheduler {

    private final OpsPlannerService plannerService;

    /**
     * Corre cada 6 horas: 00:00, 06:00, 12:00, 18:00 UTC.
     * fixedDelay = 6h en ms, initialDelay = 0 para que también corra al arrancar.
     */
    @Scheduled(fixedDelay = 6 * 60 * 60 * 1000L, initialDelay = 5_000L)
    public void scheduledPlanningRun() {
        log.info("OpsPlannerScheduler: disparando ciclo de planificación");
        try {
            plannerService.runPlanning();
        } catch (Exception e) {
            log.error("OpsPlannerScheduler: error en ciclo de planificación", e);
        }
    }
}
