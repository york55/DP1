package pe.pucp.tasfb2b.domain;

import java.time.Instant;
import java.util.Map;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

public record Solution(
    Map<String, Assignment> asignaciones
) {
    public record Assignment(
        String idEnvio,
        ShipmentStatus estado,
        Route ruta,
        Instant horaEntregaEstimadaUtc,
        int retrasoMinutos
    ) {}
}
