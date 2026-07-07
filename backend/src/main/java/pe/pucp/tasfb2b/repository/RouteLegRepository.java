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
     * PENDING legs (not yet departed) of a shipment's route — the portion of an overdue
     * shipment's journey that can still be redirected. Empty if the batch is already
     * in flight or its remaining leg has no PENDING hops left.
     */
    @Query("SELECT rl FROM RouteLeg rl JOIN FETCH rl.flight " +
           "WHERE rl.route.shipment.id = :shipmentId AND rl.status = 'PENDING' " +
           "ORDER BY rl.legOrder")
    List<RouteLeg> findPendingLegsByShipmentId(@Param("shipmentId") Long shipmentId);

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
}
