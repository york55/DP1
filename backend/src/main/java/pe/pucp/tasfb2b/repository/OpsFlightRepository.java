package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // ── AGREGADO: cancelados recientes para mostrar en el mapa/tab ───────────
    /**
     * Vuelos CANCELLED cuya fecha de vuelo es hoy o mañana.
     * Se incluyen en el snapshot para que el front los muestre en rojo,
     * sin mezclarse con los activos en la lógica de ocupación.
     */
    @Query("SELECT f FROM OpsFlight f WHERE f.status = 'CANCELLED' " +
           "AND f.flightDate >= :today AND f.flightDate <= :tomorrow")
    List<OpsFlight> findRecentlyCancelled(@Param("today") LocalDate today,
                                          @Param("tomorrow") LocalDate tomorrow);

    // ── Transición de estados por tiempo ─────────────────────────────────────

    /** SCHEDULED → IN_FLIGHT: vuelos cuya hora de salida ya llegó. */
    @Modifying
    @Query("UPDATE OpsFlight f SET f.status = 'IN_FLIGHT' " +
           "WHERE f.status = 'SCHEDULED' AND f.depTimeUtc <= :now")
    int markDepartedFlights(@Param("now") LocalDateTime now);

    /** IN_FLIGHT → LANDED: vuelos cuya hora de llegada ya pasó. */
    @Modifying
    @Query("UPDATE OpsFlight f SET f.status = 'LANDED' " +
           "WHERE f.status = 'IN_FLIGHT' AND f.arrTimeUtc <= :now")
    int markLandedFlights(@Param("now") LocalDateTime now);
}