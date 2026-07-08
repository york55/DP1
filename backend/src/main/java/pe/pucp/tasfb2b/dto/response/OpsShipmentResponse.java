package pe.pucp.tasfb2b.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record OpsShipmentResponse(
    Long   id,
    String externalId,
    String originIata,
    String destIata,
    int    bagCount,
    String cliente,
    String status,
    LocalDateTime registeredAt,
    LocalDateTime deadlineUtc,
    LocalDateTime lastUpdated,
    // Vuelos en los que el envío tiene un tramo PENDING — un envío multi-tramo puede
    // aparecer en más de uno a la vez (tramo actual + tramos futuros ya asignados).
    List<Long> flightIds
) {}
