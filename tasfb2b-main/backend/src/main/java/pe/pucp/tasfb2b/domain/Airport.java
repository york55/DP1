package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "airports")
@Getter
@Setter
@NoArgsConstructor
public class Airport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "iata_code", nullable = false, unique = true, length = 4)
    private String iataCode;

    @Column(name = "city", nullable = false, length = 120)
    private String city;

    @Column(name = "country", nullable = false, length = 80)
    private String country;

    @Column(name = "continent", nullable = false, length = 20)
    private String continent;

    @Column(name = "warehouse_capacity", nullable = false)
    private int warehouseCapacity;

    @Column(name = "current_occupancy", nullable = false)
    private int currentOccupancy = 0;

    @Column(name = "latitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public double getOccupancyPct() {
        return warehouseCapacity > 0 ? (double) currentOccupancy / warehouseCapacity * 100.0 : 0.0;
    }
}
