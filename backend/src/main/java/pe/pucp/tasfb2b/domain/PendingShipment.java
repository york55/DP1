package pe.pucp.tasfb2b.domain;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PendingShipment {
    private String shipmentId;
    private String origin;
    private String destination;
    private int quantity;
}