package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsAirport;
import java.util.List;
import java.util.Optional;

@Repository
public interface OpsAirportRepository extends JpaRepository<OpsAirport, String> {

    @Query(value = "SELECT * FROM OPS_AIRPORT", nativeQuery = true)
    List<OpsAirport> findAllAirports();

    @Query(value = "SELECT * FROM OPS_AIRPORT WHERE iata_code = :iataCode", nativeQuery = true)
    Optional<OpsAirport> findByIataCode(@Param("iataCode") String iataCode);
}
