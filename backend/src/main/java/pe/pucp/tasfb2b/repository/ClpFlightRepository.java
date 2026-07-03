package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.ClpFlight;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface ClpFlightRepository extends JpaRepository<ClpFlight, Long> {

    List<ClpFlight> findByStatus(FlightStatus status);

    @Query("SELECT f FROM ClpFlight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = :status AND f.departureTime <= :simNow")
    List<ClpFlight> findScheduledDeparting(@Param("status") FlightStatus status,
                                           @Param("simNow") LocalDateTime simNow);

    @Query("SELECT f FROM ClpFlight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = :status AND f.arrivalTime <= :simNow")
    List<ClpFlight> findInFlightArriving(@Param("status") FlightStatus status,
                                          @Param("simNow") LocalDateTime simNow);

    @Query("SELECT f FROM ClpFlight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = 'SCHEDULED' AND f.departureTime BETWEEN :from AND :to")
    List<ClpFlight> findScheduledBetween(@Param("from") LocalDateTime from,
                                          @Param("to") LocalDateTime to);

    @Query("SELECT f FROM ClpFlight f WHERE f.status = :status " +
           "AND f.departureTime > :simNow AND f.departureTime <= :simNowPlusTick")
    List<ClpFlight> findScheduledInWindow(@Param("status") FlightStatus status,
                                           @Param("simNow") LocalDateTime simNow,
                                           @Param("simNowPlusTick") LocalDateTime simNowPlusTick);

    @Query("SELECT DISTINCT f FROM ClpFlight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE (f.status = 'IN_FLIGHT' " +
           "OR (f.status = 'SCHEDULED' AND f.departureTime <= :until) " +
           "OR (f.status = 'LANDED' AND f.arrivalTime >= :since)) " +
           "AND EXISTS (SELECT 1 FROM ClpRouteLeg rl WHERE rl.flight = f)")
    List<ClpFlight> findAssignedFlightsForTick(@Param("until") LocalDateTime until,
                                                @Param("since") LocalDateTime since);

    List<ClpFlight> findByFrequency(String frequency);

    @Modifying
    @Query("DELETE FROM ClpFlight f WHERE f.frequency = 'INSTANCE'")
    void deleteAllInstances();

    @Query("SELECT f FROM ClpFlight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.originAirport.id = :originId AND f.destinationAirport.id = :destId " +
           "AND f.status = 'SCHEDULED' AND f.departureTime > :after " +
           "ORDER BY f.departureTime ASC")
    List<ClpFlight> findNextScheduledOnRoute(@Param("originId") Long originId,
                                              @Param("destId") Long destId,
                                              @Param("after") LocalDateTime after);
}
