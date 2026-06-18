package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.OpsFlight;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OpsFlightRepository extends JpaRepository<OpsFlight, Long> {

    Optional<OpsFlight> findByFlightPlanIdAndFlightDate(Long flightPlanId, LocalDate flightDate);

    /** Vuelos SCHEDULED cuya salida está dentro de la ventana de planificación. */
    @Query("SELECT f FROM OpsFlight f WHERE f.status = 'SCHEDULED' " +
           "AND f.depTimeUtc >= :from AND f.depTimeUtc < :to")
    List<OpsFlight> findScheduledInWindow(@Param("from") LocalDateTime from,
                                          @Param("to") LocalDateTime to);

    /** Vuelos que tienen al menos una ruta asignada (para el mapa). */
    @Query("SELECT DISTINCT r.flight FROM OpsShipmentRoute r " +
           "WHERE r.flight.status IN ('SCHEDULED','IN_FLIGHT') " +
           "AND r.status = 'PENDING'")
    List<OpsFlight> findFlightsWithPendingShipments();
}
