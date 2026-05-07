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

    @Query("SELECT rl FROM RouteLeg rl WHERE rl.route.id = :routeId ORDER BY rl.legOrder")
    List<RouteLeg> findByRouteIdOrderByLegOrder(@Param("routeId") Long routeId);
}
