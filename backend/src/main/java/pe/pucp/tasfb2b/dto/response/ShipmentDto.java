package pe.pucp.tasfb2b.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ShipmentDto {

    private Long id;
    private Long batchId;
    private String status;
    private LocalDateTime deadline;
    private LocalDateTime deliveredAt;
    private String originIata;
    private String destinationIata;
    private int quantity;
    private String airline;
    private LocalDateTime createdAt;
    private Long currentFlightId;
}
