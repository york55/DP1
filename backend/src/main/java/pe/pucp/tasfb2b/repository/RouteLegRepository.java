package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.RouteLeg;
import pe.pucp.tasfb2b.domain.enums.RouteLegStatus;

import java.util.List;

public interface RouteLegRepository extends JpaRepository<RouteLeg, Long> {

    @Query("SELECT rl FROM RouteLeg rl JOIN rl.flight f " +
           "WHERE f.id = :flightId AND rl.status = :status")
    List<RouteLeg> findByFlightIdAndStatus(@Param("flightId") Long flightId,
                                            @Param("status") RouteLegStatus status);

    @Query("SELECT rl FROM RouteLeg rl " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "JOIN rl.flight f " +
           "WHERE f.id = :flightId AND rl.status = :status")
    List<RouteLeg> findByFlightIdAndStatusWithBatch(@Param("flightId") Long flightId,
                                                     @Param("status") RouteLegStatus status);

    @Query("SELECT rl FROM RouteLeg rl WHERE rl.route.id = :routeId ORDER BY rl.legOrder")
    List<RouteLeg> findByRouteIdOrderByLegOrder(@Param("routeId") Long routeId);

    /**
     * Bags assigned to (but not yet boarded on) each SCHEDULED flight — used to compute
     * fleet-wide occupancy per the spec: assigned + in-flight bags over total capacity.
     */
    @Query("SELECT rl.flight.id, SUM(rl.route.shipment.baggageBatch.quantity) " +
           "FROM RouteLeg rl WHERE rl.status = 'PENDING' GROUP BY rl.flight.id")
    List<Object[]> sumPendingBagsByFlightId();

    /**
     * Flight a batch is currently boarded on — the leg whose status is IN_FLIGHT.
     * Used to surface "current flight" on the shipments list without a per-shipment query.
     */
    @Query("SELECT rl.route.shipment.baggageBatch.id, rl.flight.id " +
           "FROM RouteLeg rl WHERE rl.status = 'IN_FLIGHT'")
    List<Object[]> findCurrentFlightIdByBatchId();

    /**
     * PENDING legs (not yet departed) of a shipment's route — the portion of an overdue
     * shipment's journey that can still be redirected. Empty if the batch is already
     * in flight or its remaining leg has no PENDING hops left.
     */
    @Query("SELECT rl FROM RouteLeg rl JOIN FETCH rl.flight " +
           "WHERE rl.route.shipment.id = :shipmentId AND rl.status = 'PENDING' " +
           "ORDER BY rl.legOrder")
    List<RouteLeg> findPendingLegsByShipmentId(@Param("shipmentId") Long shipmentId);

    /**
     * True if a shipment currently has any leg still "in play" — waiting to board
     * (PENDING) or already airborne (IN_FLIGHT). Used to tell a DELAYED shipment that's
     * actually following a route apart from one that's truly stuck with nothing
     * scheduled and needs another ALNS attempt.
     */
    @Query("SELECT CASE WHEN COUNT(rl) > 0 THEN true ELSE false END FROM RouteLeg rl " +
           "WHERE rl.route.shipment.id = :shipmentId AND rl.status IN ('PENDING', 'IN_FLIGHT')")
    boolean existsActiveLegByShipmentId(@Param("shipmentId") Long shipmentId);

    /**
     * Returns the first PENDING leg for each IN_TRANSIT batch that is NOT currently on a plane.
     * The flight's origin airport is where the batch is physically waiting.
     */
    @Query("SELECT rl FROM RouteLeg rl " +
           "JOIN FETCH rl.flight f " +
           "JOIN FETCH f.originAirport " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "WHERE b.status = 'IN_TRANSIT' " +
           "AND rl.status = 'PENDING' " +
           "AND NOT EXISTS (SELECT rl2 FROM RouteLeg rl2 WHERE rl2.route = r AND rl2.status = 'IN_FLIGHT') " +
           "AND NOT EXISTS (SELECT rl3 FROM RouteLeg rl3 WHERE rl3.route = r AND rl3.status = 'PENDING' AND rl3.legOrder < rl.legOrder)")
    List<RouteLeg> findFirstPendingLegsOfTransitBagsAtIntermediateStops();

    /**
     * Tramos COMPLETED de los lotes indicados, con vuelo/aeropuertos/lote fetcheados —
     * se usa en el hilo de replanificación (sin sesión Hibernate activa) para derivar la
     * posición física actual de cada lote: el destino de su último tramo completado.
     */
    @Query("SELECT rl FROM RouteLeg rl " +
           "JOIN FETCH rl.flight f " +
           "JOIN FETCH f.destinationAirport " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "WHERE b.id IN :batchIds AND rl.status = 'COMPLETED' " +
           "ORDER BY rl.legOrder")
    List<RouteLeg> findCompletedLegsByBatchIds(@Param("batchIds") List<Long> batchIds);

    @Query("SELECT rl FROM RouteLeg rl " +
           "JOIN FETCH rl.flight f " +
           "JOIN FETCH f.originAirport oa " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport " +
           "LEFT JOIN FETCH b.airline " +
           "WHERE oa.iataCode = :iata " +
           "AND b.status = 'IN_TRANSIT' " +
           "AND rl.status = 'PENDING' " +
           "AND NOT EXISTS (SELECT rl2 FROM RouteLeg rl2 WHERE rl2.route = r AND rl2.status = 'IN_FLIGHT') " +
           "AND NOT EXISTS (SELECT rl3 FROM RouteLeg rl3 WHERE rl3.route = r AND rl3.status = 'PENDING' AND rl3.legOrder < rl.legOrder)")
    List<RouteLeg> findTransitBagsAtAirport(@Param("iata") String iata);
}