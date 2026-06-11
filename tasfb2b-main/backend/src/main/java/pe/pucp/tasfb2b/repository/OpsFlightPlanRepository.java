package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsFlightPlan;
import java.util.List;

@Repository
public interface OpsFlightPlanRepository extends JpaRepository<OpsFlightPlan, Long> {

    @Query(value = "SELECT * FROM OPS_FLIGHT_PLAN ORDER BY dep_time_local ASC", nativeQuery = true)
    List<OpsFlightPlan> findAllOrderByDeparture();

    @Modifying
    @Query(value = "UPDATE OPS_FLIGHT_PLAN SET is_active = 0 WHERE id = :id AND is_active = 1", nativeQuery = true)
    int cancelById(@Param("id") Long id);
}