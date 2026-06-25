package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;

import java.util.List;

public interface OpsShipmentRouteRepository extends JpaRepository<OpsShipmentRoute, Long> {
    List<OpsShipmentRoute> findAllByShipmentId(Long shipmentId);
    void deleteAllByShipmentId(Long shipmentId);

    // ── AGREGADO: necesario para cancelación puntual de vuelos ───────────────
    /** Todas las rutas (PENDING) asignadas a un vuelo concreto. */
    List<OpsShipmentRoute> findAllByFlightId(Long flightId);

    /** Cierra las rutas de envíos cuyo vuelo ya aterrizó, para no reprocesarlas. */
    @Modifying
    @Query("UPDATE OpsShipmentRoute r SET r.status = 'DELIVERED' " +
           "WHERE r.flight.status = 'LANDED' AND r.status = 'PENDING'")
    int markRoutesDelivered();
}