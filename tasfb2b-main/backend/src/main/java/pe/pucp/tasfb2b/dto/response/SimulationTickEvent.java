package pe.pucp.tasfb2b.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SimulationTickEvent {

    private Long simulationId;
    private int simulatedDay;
    private String simulatedTime;
    private String simulatedIso;   // full UTC ISO-8601: "2026-05-11T14:30:00"
    private long elapsedRealSeconds;

    private KpisPayload kpis;
    private List<AirportPayload> airports;
    private List<FlightPayload> flights;

    private long totalBags;
    private long deliveredBags;
    private long inTransitBags;
    private long waitingBags;
    private long delayedBags;

    private java.util.Map<String, Long> shipmentCounts;

    @Data
    @Builder
    public static class KpisPayload {
        private double onTimePct;
        private int delayedCount;
        private double avgFlightOcc;
        private double avgWarehouseOcc;
    }

    @Data
    @Builder
    public static class AirportPayload {
        private String iata;
        private double occupancyPct;
        private String semaphoreLevel;
        private int currentOccupancy;
    }

    @Data
    @Builder
    public static class FlightPayload {
        private Long flightId;
        private String originIata;
        private String destinationIata;
        private double progress;
        private String status;
        private int baggageCapacity;
        private int currentLoad;
        private String departureTime;
        private String arrivalTime;
        private String airlineName;
    }
}
