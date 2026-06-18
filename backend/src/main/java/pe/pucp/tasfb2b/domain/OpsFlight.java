package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "OPS_FLIGHT",
       uniqueConstraints = @UniqueConstraint(name = "uk_flight_plan_date",
               columnNames = {"flight_plan_id", "flight_date"}))
@Getter @Setter @NoArgsConstructor
public class OpsFlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flight_plan_id")
    private OpsFlightPlan flightPlan;

    @Column(name = "flight_date", nullable = false)
    private LocalDate flightDate;

    @Column(name = "origin_iata", length = 4)
    private String originIata;

    @Column(name = "dest_iata", length = 4)
    private String destIata;

    @Column(name = "dep_time_utc", nullable = false)
    private LocalDateTime depTimeUtc;

    @Column(name = "arr_time_utc", nullable = false)
    private LocalDateTime arrTimeUtc;

    @Column(name = "capacity")
    private int capacity;

    /** Bags committed by the planner in this run (not persisted separately; derived from routes). */
    @Transient
    private int assignedLoad = 0;

    @Column(name = "status", length = 20)
    private String status = "SCHEDULED";

    @Column(name = "cancel_reason", length = 200)
    private String cancelReason;

    // ---- helpers ----

    public int getRemainingCapacity() { return capacity - assignedLoad; }

    public double getProgress(LocalDateTime now) {
        if (!"IN_FLIGHT".equals(status)) return "LANDED".equals(status) ? 1.0 : 0.0;
        long total = java.time.Duration.between(depTimeUtc, arrTimeUtc).toMinutes();
        long elapsed = java.time.Duration.between(depTimeUtc, now).toMinutes();
        if (total <= 0) return 1.0;
        return Math.min(1.0, Math.max(0.0, (double) elapsed / total));
    }
}
