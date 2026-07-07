package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airport;

import java.util.Optional;

public interface AirportRepository extends JpaRepository<Airport, Long> {

    Optional<Airport> findByIataCode(String iataCode);

    // @Transactional here is required (not just on the caller) because this is
    // called from BlockOrchestrator's background pipeline thread, which runs
    // outside Spring's request/transaction scope and bypasses class-level
    // @Transactional via self-invocation.
    @Transactional
    @Modifying
    @Query("UPDATE Airport a SET a.currentOccupancy = 0")
    void resetAllOccupancies();
}
