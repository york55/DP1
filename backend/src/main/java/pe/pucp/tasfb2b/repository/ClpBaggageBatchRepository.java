package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.ClpBaggageBatch;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface ClpBaggageBatchRepository extends JpaRepository<ClpBaggageBatch, Long> {

    List<ClpBaggageBatch> findByStatus(BatchStatus status);

    @Query("SELECT b FROM ClpBaggageBatch b " +
           "JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport JOIN FETCH b.airline " +
           "WHERE b.status IN ('IN_ORIGIN', 'DELAYED') AND b.availableFrom <= :simNow")
    List<ClpBaggageBatch> findPendingBatches(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT b FROM ClpBaggageBatch b " +
           "JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport JOIN FETCH b.airline " +
           "WHERE b.status = 'IN_ORIGIN' AND b.availableFrom <= :simNow " +
           "AND NOT EXISTS (SELECT s FROM ClpShipment s WHERE s.baggageBatch = b)")
    List<ClpBaggageBatch> findUnroutedBatches(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT b FROM ClpBaggageBatch b JOIN FETCH b.destinationAirport " +
           "WHERE b.status = 'DELIVERED' " +
           "AND EXISTS (SELECT s FROM ClpShipment s WHERE s.baggageBatch = b AND s.deliveredAt > :cutoff)")
    List<ClpBaggageBatch> findRecentlyDelivered(@Param("cutoff") LocalDateTime cutoff);

    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM ClpBaggageBatch b WHERE b.status = :status")
    long sumQuantityByStatus(@Param("status") BatchStatus status);

    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM ClpBaggageBatch b")
    long sumAllQuantity();

    long countByStatus(BatchStatus status);
}
