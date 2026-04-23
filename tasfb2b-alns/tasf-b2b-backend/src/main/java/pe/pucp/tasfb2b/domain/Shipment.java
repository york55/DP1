package pe.pucp.tasfb2b.domain;

import java.time.Instant;

public record Shipment(
    String idEnvio,
    String iataOrigen,
    String iataDestino,
    String tipoPaquete,
    int cantidadMaletas,
    Instant horaDisponibilidadUtc
) {}
