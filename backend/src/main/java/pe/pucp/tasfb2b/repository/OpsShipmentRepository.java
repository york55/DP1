package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsShipment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface OpsShipmentRepository extends JpaRepository<OpsShipment, Long> {
    List<OpsShipment> findAllByStatus(String status);
    List<OpsShipment> findAllByStatusIn(Collection<String> statuses);

    /** Para ocupación temporal en destino: entregados dentro de la ventana de 15 min. */
    List<OpsShipment> findAllByStatusAndLastUpdatedAfter(String status, LocalDateTime cutoff);

    @Modifying
    @Query("UPDATE OpsShipment s SET s.status = 'IN_FLIGHT', s.lastUpdated = :now " +
           "WHERE s.status = 'PLANNED' " +
           "AND s.id IN (SELECT r.shipment.id FROM OpsShipmentRoute r " +
           "WHERE r.flight.status = 'IN_FLIGHT' AND r.status = 'PENDING')")
    int markShipmentsInFlight(@Param("now") LocalDateTime now);

    /**
     * IN_FLIGHT → DELIVERED: envíos cuyo vuelo asignado ya aterrizó (LANDED).
     * lastUpdated = now queda como el "momento de entrega", usado luego para
     * calcular la ventana de 15 min de ocupación en el almacén de destino.
     */
    @Modifying
    @Query("UPDATE OpsShipment s SET s.status = 'DELIVERED', s.lastUpdated = :now " +
           "WHERE s.status = 'IN_FLIGHT' " +
           "AND s.id IN (SELECT r.shipment.id FROM OpsShipmentRoute r " +
           "WHERE r.flight.status = 'LANDED' AND r.status = 'PENDING')")
    int markShipmentsDelivered(@Param("now") LocalDateTime now);
}