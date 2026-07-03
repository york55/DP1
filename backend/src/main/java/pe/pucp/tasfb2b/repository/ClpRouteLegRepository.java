package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.ClpRouteLeg;
import pe.pucp.tasfb2b.domain.enums.RouteLegStatus;

import java.util.List;

public interface ClpRouteLegRepository extends JpaRepository<ClpRouteLeg, Long> {

    @Query("SELECT rl FROM ClpRouteLeg rl JOIN rl.flight f " +
           "WHERE f.id = :flightId AND rl.status = :status")
    List<ClpRouteLeg> findByFlightIdAndStatus(@Param("flightId") Long flightId,
                                               @Param("status") RouteLegStatus status);

    @Query("SELECT rl FROM ClpRouteLeg rl " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "JOIN rl.flight f " +
           "WHERE f.id = :flightId AND rl.status = :status")
    List<ClpRouteLeg> findByFlightIdAndStatusWithBatch(@Param("flightId") Long flightId,
                                                        @Param("status") RouteLegStatus status);

    @Query("SELECT rl FROM ClpRouteLeg rl WHERE rl.route.id = :routeId ORDER BY rl.legOrder")
    List<ClpRouteLeg> findByRouteIdOrderByLegOrder(@Param("routeId") Long routeId);

    @Query("SELECT rl FROM ClpRouteLeg rl " +
           "JOIN FETCH rl.flight f " +
           "JOIN FETCH f.originAirport " +
           "JOIN FETCH rl.route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "WHERE b.status = 'IN_TRANSIT' " +
           "AND rl.status = 'PENDING' " +
           "AND NOT EXISTS (SELECT rl2 FROM ClpRouteLeg rl2 WHERE rl2.route = r AND rl2.status = 'IN_FLIGHT') " +
           "AND NOT EXISTS (SELECT rl3 FROM ClpRouteLeg rl3 WHERE rl3.route = r AND rl3.status = 'PENDING' AND rl3.legOrder < rl.legOrder)")
    List<ClpRouteLeg> findFirstPendingLegsOfTransitBagsAtIntermediateStops();
}
