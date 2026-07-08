package pe.pucp.tasfb2b.dto.response;

public record LoginResponse(
    Long   id,
    String fullName,
    String username,
    String airportIata,
    String airportName,
    String airportCountry,
    Integer airportGmtOffset
) {}