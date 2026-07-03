package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "Clp_routes")
@Getter
@Setter
@NoArgsConstructor
public class ClpRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", nullable = false, unique = true)
    private ClpShipment shipment;

    @Column(name = "total_legs", nullable = false)
    private int totalLegs;

    @Column(name = "algorithm_used", nullable = false, length = 20)
    private String algorithmUsed;

    @Column(name = "estimated_arrival", nullable = false)
    private LocalDateTime estimatedArrival;

    @Column(name = "actual_arrival")
    private LocalDateTime actualArrival;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("legOrder ASC")
    private List<ClpRouteLeg> legs = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
