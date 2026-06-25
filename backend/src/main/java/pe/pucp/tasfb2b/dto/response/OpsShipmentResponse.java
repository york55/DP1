package pe.pucp.tasfb2b.dto.response;

import java.time.LocalDateTime;

public record OpsShipmentResponse(
    Long   id,
    String externalId,
    String originIata,
    String destIata,
    int    bagCount,
    String status,
    LocalDateTime registeredAt,
    LocalDateTime deadlineUtc,
    LocalDateTime lastUpdated
) {}