package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.FlightCancellation;

import java.util.List;

public interface FlightCancellationRepository extends JpaRepository<FlightCancellation, Long> {

    List<FlightCancellation> findByFlightId(Long flightId);

    boolean existsByFlightId(Long flightId);

    // Bulk delete en SQL directo (no derived delete): un derived delete solo encola los
    // remove() en el contexto de persistencia, y el DELETE masivo posterior de flights
    // (deleteAllInstances) ejecuta SQL inmediato — la FK de flight_cancellations→flights
    // reventaba porque las cancelaciones seguían en la BD al borrar los vuelos.
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM FlightCancellation fc WHERE fc.flight.id IN :flightIds")
    void deleteByFlightIdIn(@Param("flightIds") List<Long> flightIds);
}
