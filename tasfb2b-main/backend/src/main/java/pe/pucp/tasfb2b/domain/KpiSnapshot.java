package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "kpi_snapshots")
@Getter
@Setter
@NoArgsConstructor
public class KpiSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "simulation_id", nullable = false)
    private Simulation simulation;

    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

    @Column(name = "on_time_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal onTimePct;

    @Column(name = "delayed_count", nullable = false)
    private int delayedCount;

    @Column(name = "avg_flight_occupancy", nullable = false, precision = 5, scale = 2)
    private BigDecimal avgFlightOccupancy;

    @Column(name = "avg_warehouse_occupancy", nullable = false, precision = 5, scale = 2)
    private BigDecimal avgWarehouseOccupancy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
