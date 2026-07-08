package pe.pucp.tasfb2b.dto.response;

import java.time.LocalDateTime;

public record RouteLegDto(
    int legOrder,
    Long flightId,
    String originIata,
    String destinationIata,
    LocalDateTime departureUTC,
    LocalDateTime arrivalUTC,
    String status
) {}
