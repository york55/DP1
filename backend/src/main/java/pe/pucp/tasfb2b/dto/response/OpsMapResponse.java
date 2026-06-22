package pe.pucp.tasfb2b.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Payload que el mapa en tiempo real consume desde GET /ops/map/snapshot.
 */
@Data
@Builder
public class OpsMapResponse {

    private List<AirportDto> airports;
    private List<ActiveFlightDto> flights;
    private List<OpsShipmentResponse> shipments;
    @Data
    @Builder
    public static class AirportDto {
        private String iataCode;
        private String name;
        private String country;
        private double latitude;
        private double longitude;
        private int    capacity;
        /** Número de envíos actualmente asignados (PLANNED o IN_TRANSIT) con origen en este aeropuerto. */
        private int    assignedShipments;
        /** Ocupación porcentual: assignedShipments / capacity * 100 */
        private double occupancyPct;
    }

    @Data
    @Builder
    public static class ActiveFlightDto {
        private Long   flightId;
        private String originIata;
        private String destIata;
        private String originName;
        private String destName;
        private double originLat;
        private double originLng;
        private double destLat;
        private double destLng;
        /** Progreso 0.0-1.0 basado en tiempo actual vs dep/arr UTC */
        private double progress;
        private String status;         // SCHEDULED | IN_FLIGHT | LANDED
        private String depTimeUtc;     // ISO-8601
        private String arrTimeUtc;
        private int    capacity;
        private int    assignedBags;   // suma de bagCount de los envíos asignados
    }
}
