package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.FlightCancellation;

import java.util.List;

public interface FlightCancellationRepository extends JpaRepository<FlightCancellation, Long> {

    List<FlightCancellation> findByFlightId(Long flightId);
}
