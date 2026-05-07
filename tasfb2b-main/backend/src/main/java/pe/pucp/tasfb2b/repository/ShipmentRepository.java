package pe.pucp.tasfb2b.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.Shipment;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

    Page<Shipment> findByStatus(ShipmentStatus status, Pageable pageable);

    List<Shipment> findByStatus(ShipmentStatus status);

    @Query("SELECT s FROM Shipment s WHERE s.status NOT IN ('DELIVERED') " +
           "AND s.deadline < :simNow")
    List<Shipment> findOverdueShipments(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.status = 'DELIVERED' " +
           "AND s.deliveredAt <= s.deadline")
    long countOnTimeDeliveries();

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.status = 'DELIVERED'")
    long countDelivered();

    @Query("SELECT COUNT(s) FROM Shipment s")
    long countTotal();

    Optional<Shipment> findByBaggageBatchId(Long batchId);
}
