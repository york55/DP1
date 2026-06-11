package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsShipment;

@Repository
public interface OpsShipmentRepository extends JpaRepository<OpsShipment, Long> {
}