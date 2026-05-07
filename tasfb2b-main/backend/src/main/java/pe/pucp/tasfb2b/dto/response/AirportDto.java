package pe.pucp.tasfb2b.dto.response;

import lombok.Data;

import java.util.List;

@Data
public class AirportDto {

    private Long id;
    private String iata;
    private String city;
    private String country;
    private String continent;
    private int warehouseCapacity;
    private int currentOccupancy;
    private double occupancyPct;
    private String semaphoreLevel;
    private double latitude;
    private double longitude;
    private List<FlightDto> inboundFlights;
    private List<FlightDto> outboundFlights;
}
