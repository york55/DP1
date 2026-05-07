package pe.pucp.tasfb2b.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FlightDto {

    private Long id;
    private String originIata;
    private String destinationIata;
    private double originLat;
    private double originLon;
    private double destinationLat;
    private double destinationLon;
    private LocalDateTime departureTime;
    private LocalDateTime arrivalTime;
    private int baggageCapacity;
    private int currentLoad;
    private String frequency;
    private String status;
    private double progress;
}
