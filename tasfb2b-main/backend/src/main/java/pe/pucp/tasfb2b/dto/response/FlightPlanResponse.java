package pe.pucp.tasfb2b.dto.response;

public record FlightPlanResponse(
    String origin,
    String destination,
    String departureTime,
    String arrivalTime,
    int capacity
) {}