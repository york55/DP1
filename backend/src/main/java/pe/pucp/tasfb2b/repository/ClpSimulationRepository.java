package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.ClpSimulation;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;

import java.util.List;

public interface ClpSimulationRepository extends JpaRepository<ClpSimulation, Long> {

    List<ClpSimulation> findByStatus(SimulationStatus status);
}
