package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;

import java.util.List;

public interface OpsShipmentRouteRepository extends JpaRepository<OpsShipmentRoute, Long> {
    List<OpsShipmentRoute> findAllByShipmentId(Long shipmentId);
    void deleteAllByShipmentId(Long shipmentId);
}
