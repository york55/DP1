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

    // ── AGREGADO: soporte para Problema 1 (envío se cierra antes de completar ruta) ──

    /**
     * Tramos PENDING cuyo vuelo ya aterrizó (LANDED). Se procesan en Java
     * (OpsFlightStatusService) porque hay que comparar cada uno contra el
     * step_order máximo de su propio envío para saber si es el último tramo
     * o queda ruta pendiente — algo que una sola query UPDATE no puede decidir.
     */
    @Query("SELECT r FROM OpsShipmentRoute r " +
           "WHERE r.status = 'PENDING' AND r.flight.status = 'LANDED'")
    List<OpsShipmentRoute> findPendingRoutesWithLandedFlight();

    /** step_order máximo entre todos los tramos (cualquier status) de un envío. */
    @Query("SELECT MAX(r.stepOrder) FROM OpsShipmentRoute r WHERE r.shipment.id = :shipmentId")
    Integer findMaxStepOrderByShipmentId(@Param("shipmentId") Long shipmentId);

    // ── AGREGADO: soporte para 2a (no pasar a PENDING un envío con un tramo IN_FLIGHT) ──

    /** ¿Tiene el envío algún tramo cuyo vuelo esté actualmente IN_FLIGHT? */
    @Query("SELECT COUNT(r) > 0 FROM OpsShipmentRoute r " +
           "WHERE r.shipment.id = :shipmentId AND r.flight.status = 'IN_FLIGHT'")
    boolean existsInFlightLegForShipment(@Param("shipmentId") Long shipmentId);

    // ── AGREGADO: soporte para distinguir avance normal vs. tramo cancelado ──
    /**
     * ¿Le queda al envío otro tramo PENDING (distinto de excludeLegId) con vuelo
     * asignado? Se usa al aterrizar un tramo intermedio para saber si el envío
     * puede seguir tal cual (ya tiene el siguiente vuelo) o si ese tramo
     * siguiente fue borrado por una cancelación y el envío necesita volver a
     * PENDING para que el planificador le arme una ruta nueva desde donde está.
     */
    @Query("SELECT COUNT(r) > 0 FROM OpsShipmentRoute r " +
           "WHERE r.shipment.id = :shipmentId AND r.status = 'PENDING' AND r.id <> :excludeLegId")
    boolean existsOtherPendingLegForShipment(@Param("shipmentId") Long shipmentId,
                                              @Param("excludeLegId") Long excludeLegId);

    // ── AGREGADO: soporte para 2b (blindaje al borrar rutas previas en replanificación) ──

    /**
     * Borra las rutas previas de un envío al replanificar, EXCLUYENDO cualquier
     * tramo cuyo vuelo esté actualmente IN_FLIGHT (no debería llegar a pasar si
     * el Problema 1 y el punto 2a están resueltos, pero es un blindaje barato
     * contra un caso borde que deje un tramo en vuelo huérfano).
     */
    @Modifying
    @Query("DELETE FROM OpsShipmentRoute r WHERE r.shipment.id = :shipmentId " +
           "AND (r.flight IS NULL OR r.flight.status <> 'IN_FLIGHT')")
    void deleteAllByShipmentIdExceptInFlight(@Param("shipmentId") Long shipmentId);
}