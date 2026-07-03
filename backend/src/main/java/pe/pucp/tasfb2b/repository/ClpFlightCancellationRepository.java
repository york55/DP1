package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.ClpFlightCancellation;

import java.util.List;

public interface ClpFlightCancellationRepository extends JpaRepository<ClpFlightCancellation, Long> {

    boolean existsByFlightId(Long flightId);

    @Transactional
    void deleteByFlightIdIn(List<Long> flightIds);
}
