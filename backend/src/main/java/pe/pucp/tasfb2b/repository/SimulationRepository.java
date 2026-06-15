package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.pucp.tasfb2b.domain.Simulation;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;

import java.util.List;

public interface SimulationRepository extends JpaRepository<Simulation, Long> {

    List<Simulation> findByStatus(SimulationStatus status);
}
