package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.ClpShipment;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface ClpShipmentRepository extends JpaRepository<ClpShipment, Long> {

    @Query("SELECT s FROM ClpShipment s WHERE s.status NOT IN ('DELIVERED') " +
           "AND s.deadline < :simNow")
    List<ClpShipment> findOverdueShipments(@Param("simNow") LocalDateTime simNow);

    @Query("SELECT COUNT(s) FROM ClpShipment s WHERE s.status = 'DELIVERED' " +
           "AND s.deliveredAt <= s.deadline")
    long countOnTimeDeliveries();

    @Query("SELECT COUNT(s) FROM ClpShipment s WHERE s.status = 'DELIVERED'")
    long countDelivered();

    @Query("SELECT COUNT(s) FROM ClpShipment s")
    long countTotal();

    long countByStatus(ShipmentStatus status);
}
