package pe.pucp.tasfb2b.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class KpiDto {

    private Long id;
    private LocalDateTime snapshotTime;
    private double onTimePct;
    private int delayedCount;
    private double avgFlightOccupancy;
    private double avgWarehouseOccupancy;
}
