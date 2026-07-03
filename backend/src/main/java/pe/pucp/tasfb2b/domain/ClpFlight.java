package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "Clp_flights")
@Getter
@Setter
@NoArgsConstructor
public class ClpFlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "airline_id")
    private Airline airline;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origin_airport_id", nullable = false)
    private ClpAirport originAirport;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_airport_id", nullable = false)
    private ClpAirport destinationAirport;

    @Column(name = "departure_time", nullable = false)
    private LocalDateTime departureTime;

    @Column(name = "arrival_time", nullable = false)
    private LocalDateTime arrivalTime;

    @Column(name = "baggage_capacity", nullable = false)
    private int baggageCapacity;

    @Column(name = "current_load", nullable = false)
    private int currentLoad = 0;

    @Column(name = "frequency", nullable = false, length = 20)
    private String frequency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FlightStatus status = FlightStatus.SCHEDULED;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public int getRemainingCapacity() {
        return baggageCapacity - currentLoad;
    }

    public boolean isSameContinent() {
        return originAirport.getContinent().equals(destinationAirport.getContinent());
    }

    public double getProgress(LocalDateTime simNow) {
        if (status != FlightStatus.IN_FLIGHT) return status == FlightStatus.LANDED ? 1.0 : 0.0;
        long total = Duration.between(departureTime, arrivalTime).toMinutes();
        long elapsed = Duration.between(departureTime, simNow).toMinutes();
        if (total <= 0) return 1.0;
        return Math.min(1.0, Math.max(0.0, (double) elapsed / total));
    }
}
