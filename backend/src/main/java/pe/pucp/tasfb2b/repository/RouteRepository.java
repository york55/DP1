package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import pe.pucp.tasfb2b.domain.Route;

import java.util.List;
import java.util.Optional;

public interface RouteRepository extends JpaRepository<Route, Long> {

    Optional<Route> findByShipmentId(Long shipmentId);

    @Query("SELECT DISTINCT r FROM Route r " +
           "JOIN FETCH r.shipment s " +
           "JOIN FETCH s.baggageBatch b " +
           "JOIN FETCH b.originAirport " +
           "JOIN FETCH b.destinationAirport " +
           "LEFT JOIN FETCH b.airline " +
           "JOIN FETCH r.legs rl " +
           "JOIN FETCH rl.flight f " +
           "JOIN FETCH f.originAirport " +
           "JOIN FETCH f.destinationAirport " +
           "WHERE s.status IN ('DELIVERED', 'DELAYED') " +
           "AND NOT EXISTS (SELECT rl2 FROM RouteLeg rl2 WHERE rl2.route = r AND rl2.status IN ('PENDING', 'IN_FLIGHT'))")
    List<Route> findCompletedRoutesWithLegs();
}
