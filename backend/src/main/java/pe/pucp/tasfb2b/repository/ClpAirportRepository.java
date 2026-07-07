package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.ClpAirport;

import java.util.Optional;

public interface ClpAirportRepository extends JpaRepository<ClpAirport, Long> {

    Optional<ClpAirport> findByIataCode(String iataCode);

    @Transactional
    @Modifying
    @Query("UPDATE ClpAirport a SET a.currentOccupancy = 0")
    void resetAllOccupancies();
}
