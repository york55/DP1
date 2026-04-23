package pe.pucp.tasfb2b.domain;

import java.time.Instant;

public record Flight(
    String idVuelo,
    String iataOrigen,
    String iataDestino,
    Instant horaSalidaUtc,
    Instant horaLlegadaUtc,
    int capacidadMaletas,
    boolean cancelado
) {}
