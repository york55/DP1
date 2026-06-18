package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsShipment;

import java.util.List;

@Repository
public interface OpsShipmentRepository extends JpaRepository<OpsShipment, Long> {
    List<OpsShipment> findAllByStatus(String status);
}