package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.KpiSnapshot;

import java.util.List;

public interface KpiSnapshotRepository extends JpaRepository<KpiSnapshot, Long> {

    List<KpiSnapshot> findBySimulationIdOrderBySnapshotTimeAsc(Long simulationId);

    KpiSnapshot findFirstBySimulationIdOrderBySnapshotTimeDesc(Long simulationId);
}
