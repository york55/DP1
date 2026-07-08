package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.ClpKpiSnapshot;

import java.util.List;

public interface ClpKpiSnapshotRepository extends JpaRepository<ClpKpiSnapshot, Long> {

    List<ClpKpiSnapshot> findBySimulationIdOrderBySnapshotTimeAsc(Long simulationId);

    ClpKpiSnapshot findFirstBySimulationIdOrderBySnapshotTimeDesc(Long simulationId);
}
