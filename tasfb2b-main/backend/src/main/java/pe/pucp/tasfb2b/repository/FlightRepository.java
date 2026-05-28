package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface FlightRepository extends JpaRepository<Flight, Long> {

    List<Flight> findByStatus(FlightStatus status);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = :status AND f.departureTime <= :simNow")
    List<Flight> findScheduledDeparting(@Param("status") FlightStatus status,
                                        @Param("simNow") LocalDateTime simNow);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = :status AND f.arrivalTime <= :simNow")
    List<Flight> findInFlightArriving(@Param("status") FlightStatus status,
                                       @Param("simNow") LocalDateTime simNow);

    @Query("SELECT f FROM Flight f " +
           "JOIN FETCH f.originAirport o " +
           "JOIN FETCH f.destinationAirport d " +
           "WHERE o.iataCode = :origin AND d.iataCode = :destination " +
           "AND f.departureTime >= :from AND f.status = 'SCHEDULED'")
    List<Flight> findDirectFlights(@Param("origin") String origin,
                                   @Param("destination") String destination,
                                   @Param("from") LocalDateTime from);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = 'SCHEDULED' AND f.departureTime BETWEEN :from AND :to")
    List<Flight> findScheduledBetween(@Param("from") LocalDateTime from,
                                      @Param("to") LocalDateTime to);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.departureTime BETWEEN :from AND :to")
    List<Flight> findAllBetween(@Param("from") LocalDateTime from,
                                @Param("to") LocalDateTime to);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport")
    List<Flight> findAllWithAirports();

    @Query("SELECT f FROM Flight f WHERE f.status = :status " +
           "AND f.departureTime > :simNow AND f.departureTime <= :simNowPlusTick")
    List<Flight> findScheduledInWindow(@Param("status") FlightStatus status,
                                       @Param("simNow") LocalDateTime simNow,
                                       @Param("simNowPlusTick") LocalDateTime simNowPlusTick);

    @Query("SELECT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE f.status = 'IN_FLIGHT' " +
           "OR (f.status = 'SCHEDULED' AND f.departureTime <= :until)")
    List<Flight> findActiveFlightsForTick(@Param("until") LocalDateTime until);

    @Query("SELECT DISTINCT f FROM Flight f JOIN FETCH f.originAirport JOIN FETCH f.destinationAirport " +
           "WHERE (f.status = 'IN_FLIGHT' " +
           "OR (f.status = 'SCHEDULED' AND f.departureTime <= :until) " +
           "OR (f.status = 'LANDED' AND f.arrivalTime >= :since)) " +
           "AND EXISTS (SELECT 1 FROM RouteLeg rl WHERE rl.flight = f)")
    List<Flight> findAssignedFlightsForTick(@Param("until") LocalDateTime until, @Param("since") LocalDateTime since);
}
