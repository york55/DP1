package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "OPS_SHIPMENT_ROUTE",
       uniqueConstraints = @UniqueConstraint(name = "uk_shipment_route",
               columnNames = {"shipment_id", "step_order"}))
@Getter @Setter @NoArgsConstructor
public class OpsShipmentRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false)
    private OpsShipment shipment;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flight_id")
    private OpsFlight flight;

    @Column(name = "status", length = 20)
    private String status = "PENDING";

    @Column(name = "actual_arr_utc")
    private LocalDateTime actualArrUtc;
}
