package pe.pucp.tasfb2b.dto.response;

public record OpsAirportResponse(
    String iataCode,
    String name,
    String country,
    String continent,
    Integer gmtOffset,
    Integer capacity,
    Double latitude,
    Double longitude
) {}