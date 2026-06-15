package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulations")
@Getter
@Setter
@NoArgsConstructor
public class Simulation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "scenario_type", nullable = false, length = 32)
    private ScenarioType scenarioType;

    @Column(name = "period_days")
    private Integer periodDays;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "cancellation_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal cancellationRate = BigDecimal.valueOf(0.00);

    @Column(name = "seed", nullable = false)
    private Long seed;

    @Column(name = "volume_per_day", nullable = false)
    private int volumePerDay;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SimulationStatus status = SimulationStatus.CONFIGURED;

    @Column(name = "algorithm", nullable = false, length = 20)
    private String algorithm = "ALNS";

    @Column(name = "t0")
    private Double t0;

    @Column(name = "alpha_sa")
    private Double alphaSa;

    @Column(name = "q_pct")
    private Double qPct;

    @Column(name = "max_iterations")
    private Integer maxIterations;

    @Column(name = "simulated_time")
    private LocalDateTime simulatedTime;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
