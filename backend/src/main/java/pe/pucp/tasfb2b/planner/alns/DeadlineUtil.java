package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.domain.BaggageBatch;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Cálculo centralizado del deadline SLA de un lote (1 día mismo continente / 2 días
 * distinto continente), para que la MISMA regla se use tanto al persistir el Shipment
 * como, ahora, dentro de la búsqueda del ALNS (evaluate, costo de inserción, worst removal).
 *
 * Antes esta regla solo vivía en AlnsEngine.buildRoutes(), es decir, se calculaba DESPUÉS
 * de que la ruta ya había sido decidida — el algoritmo nunca la veía mientras optimizaba.
 */
public final class DeadlineUtil {

    private DeadlineUtil() {
    }

    public static LocalDateTime computeDeadline(BaggageBatch batch) {
        int days = batch.isSameContinent() ? 1 : 2;
        return batch.getAvailableFrom().plus(days, ChronoUnit.DAYS);
    }
}
