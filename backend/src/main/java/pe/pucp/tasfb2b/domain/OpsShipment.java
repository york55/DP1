package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "OPS_SHIPMENT")
@Getter @Setter @NoArgsConstructor
public class OpsShipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "external_id", length = 20, unique = true)
    private String externalId;

    @Column(name = "registered_at", nullable = false)
    private LocalDateTime registeredAt;

    @Column(name = "origin_iata", length = 4)
    private String originIata;

    @Column(name = "dest_iata", length = 4)
    private String destIata;

    @Column(name = "bag_count", nullable = false)
    private Integer bagCount;

    @Column(name = "client_code", length = 100)
    private String clientCode;

    @Column(name = "status", length = 20)
    private String status = "PENDING";

    @Column(name = "deadline_utc")
    private LocalDateTime deadlineUtc;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;
}
