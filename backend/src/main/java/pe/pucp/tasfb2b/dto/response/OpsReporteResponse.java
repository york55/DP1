package pe.pucp.tasfb2b.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

/**
 * Resumen diario de operaciones para el módulo de Reportes.
 */
@Data
@Builder
public class OpsReporteResponse {

    private LocalDate fecha;

    // ── Vuelos ────────────────────────────────────────────────────────────────
    /** Total de vuelos programados para ese día (cualquier estado). */
    private int totalVuelos;

    /** Vuelos que despegaron (IN_FLIGHT o LANDED). */
    private int vuelosOperados;

    /** Vuelos cancelados ese día. */
    private int vuelosCancelados;

    /** Vuelos que tuvieron al menos un envío asignado. */
    private int vuelosConEnvios;

    // ── Envíos ────────────────────────────────────────────────────────────────
    /** Envíos registrados (registeredAt) ese día. */
    private int enviosRegistrados;

    /** Total de maletas en los envíos registrados ese día. */
    private int maletasRegistradas;

    /** Envíos entregados (DELIVERED) ese día. */
    private int enviosEntregados;

    /** Maletas entregadas ese día. */
    private int maletasEntregadas;

    /** Envíos que no llegaron antes de su deadline (DELAYED o aún no entregados con deadline pasado). */
    private int enviosRetrasados;

    // ── Utilización ───────────────────────────────────────────────────────────
    /** Promedio de ocupación de los vuelos operados ese día (0-100). */
    private double ocupacionPromedioVuelos;
}
