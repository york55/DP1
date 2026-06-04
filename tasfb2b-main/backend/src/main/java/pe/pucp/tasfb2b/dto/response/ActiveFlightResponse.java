package pe.pucp.tasfb2b.dto.response;

public record ActiveFlightResponse(
    String flightKey,
    String origin,
    String destination,
    String departureUtc,
    String arrivalUtc,
    String departureLocal,
    String arrivalLocal,
    int capacity,
    boolean cancelled
) {}