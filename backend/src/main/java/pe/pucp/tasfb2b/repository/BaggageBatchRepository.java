package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface BaggageBatchRepository extends JpaRepository<BaggageBatch, Long> {

    List<BaggageBatch> findByStatus(BatchStatus status);

    @Query("SELECT b FROM BaggageBatch b " +
           "JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport JOIN FETCH b.airline " +
           "WHERE b.status IN ('IN_ORIGIN', 'DELAYED') AND b.availableFrom <= :simNow")
    List<BaggageBatch> findPendingBatches(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT b FROM BaggageBatch b " +
           "JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport JOIN FETCH b.airline " +
           "WHERE b.status = 'IN_ORIGIN' AND b.availableFrom <= :simNow " +
           "AND NOT EXISTS (SELECT s FROM Shipment s WHERE s.baggageBatch = b)")
    List<BaggageBatch> findUnroutedBatches(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT b FROM BaggageBatch b JOIN FETCH b.originAirport JOIN FETCH b.destinationAirport")
    List<BaggageBatch> findAllWithAirports();

    // Batches DELIVERED within the last 15 simulated minutes — still occupying destination storage.
    @Query("SELECT b FROM BaggageBatch b JOIN FETCH b.destinationAirport " +
           "WHERE b.status = 'DELIVERED' " +
           "AND EXISTS (SELECT s FROM Shipment s WHERE s.baggageBatch = b AND s.deliveredAt > :cutoff)")
    List<BaggageBatch> findRecentlyDelivered(@Param("cutoff") LocalDateTime cutoff);

    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM BaggageBatch b WHERE b.status = :status")
    long sumQuantityByStatus(@Param("status") BatchStatus status);

    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM BaggageBatch b")
    long sumAllQuantity();

    @Modifying
    @Query("UPDATE BaggageBatch b SET b.status = 'IN_ORIGIN'")
    void resetAllToInOrigin();
}
