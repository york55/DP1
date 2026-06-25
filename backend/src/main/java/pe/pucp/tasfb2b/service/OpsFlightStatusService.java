package pe.pucp.tasfb2b.service;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * Mantiene sincronizado el estado de OPS_FLIGHT con el paso del tiempo real:
 *   SCHEDULED → IN_FLIGHT  (cuando depTimeUtc <= now)
 *   IN_FLIGHT → LANDED     (cuando arrTimeUtc <= now)
 *
 * También sincroniza OPS_SHIPMENT con el vuelo en el que va:
 *   PLANNED → IN_FLIGHT    (cuando su vuelo asignado despega)
 *
 * Nota: el orden importa. markShipmentsInFlight() corre ANTES de
 * markLandedFlights() para no perder la transición de envíos en vuelos
 * muy cortos que despegan y aterrizan dentro de la misma ventana de 2 min.
 *
 * No reemplaza la lógica de cancelación (pendiente, distinta responsabilidad):
 * un vuelo CANCELLED simplemente nunca entra en estas queries porque ya no
 * está en estado SCHEDULED/IN_FLIGHT.
 *
 * Pendiente (fuera de alcance por ahora): qué estado toma el envío cuando
 * su vuelo aterriza (LANDED). Mientras no se decida, el envío se queda en
 * IN_FLIGHT incluso después de que el vuelo aterrizó.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsFlightStatusService {

    private final OpsFlightRepository flightRepo;
    private final OpsShipmentRepository shipmentRepo;
	private final OpsShipmentRouteRepository routeRepo;

    @Transactional
	public void syncFlightStatuses() {
		LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

		int departed = flightRepo.markDepartedFlights(now);
		int shipmentsInFlight = shipmentRepo.markShipmentsInFlight(now);
		int landed = flightRepo.markLandedFlights(now);

		// Debe correr DESPUÉS de markLandedFlights (necesita flight.status = 'LANDED')
		// y ANTES de cerrar las rutas (la query depende de route.status = 'PENDING').
		int delivered = shipmentRepo.markShipmentsDelivered(now);
		routeRepo.markRoutesDelivered();

		if (departed > 0 || landed > 0 || shipmentsInFlight > 0 || delivered > 0) {
			log.info("OpsFlightStatusService: {} vuelos a IN_FLIGHT, {} a LANDED, " +
					  "{} envíos a IN_FLIGHT, {} envíos a DELIVERED",
					departed, landed, shipmentsInFlight, delivered);
		}
	}
	
}