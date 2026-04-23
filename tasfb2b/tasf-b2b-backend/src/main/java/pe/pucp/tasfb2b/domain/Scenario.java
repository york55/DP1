package pe.pucp.tasfb2b.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record Scenario(
    Map<String, Airport> aeropuertos,
    List<Flight> vuelos,
    List<Shipment> envios,
    int periodoDias,
    Instant fechaInicioUtc,
    long semillaAleatoria,
    String algoritmo,
    double w1,
    double w2,
    double w3
) {}
