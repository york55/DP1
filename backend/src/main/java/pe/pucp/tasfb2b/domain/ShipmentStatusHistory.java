package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "shipment_status_history")
@Getter
@Setter
@NoArgsConstructor
public class ShipmentStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false)
    private Shipment shipment;

    @Column(name = "old_status", nullable = false, length = 32)
    private String oldStatus;

    @Column(name = "new_status", nullable = false, length = 32)
    private String newStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "airport_id")
    private Airport airport;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public ShipmentStatusHistory(Shipment shipment, String oldStatus, String newStatus,
                                  Airport airport, LocalDateTime changedAt) {
        this.shipment = shipment;
        this.oldStatus = oldStatus;
        this.newStatus = newStatus;
        this.airport = airport;
        this.changedAt = changedAt;
    }
}
