package pe.pucp.tasfb2b.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ClpSimulationDto {

    private Long id;
    private String scenarioType;
    private LocalDateTime startDate;
    private String status;
    private String algorithm;
    private Double cancellationRate;
    private Long seed;
    private int volumePerDay;
    private LocalDateTime simulatedTime;
    private int daysSimulated;
    private LocalDateTime collapsedAt;
    private String collapsedAirportIata;
    private LocalDateTime createdAt;
    private KpiDto currentKpi;
}
