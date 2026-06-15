package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pe.pucp.tasfb2b.domain.Airport;

import java.util.Optional;

public interface AirportRepository extends JpaRepository<Airport, Long> {

    Optional<Airport> findByIataCode(String iataCode);

    @Modifying
    @Query("UPDATE Airport a SET a.currentOccupancy = 0")
    void resetAllOccupancies();
}
