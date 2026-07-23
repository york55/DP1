package pe.pucp.tasfb2b.service;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
 * Al aterrizar un vuelo (LANDED), cada tramo (OpsShipmentRoute) PENDING de
 * ese vuelo se resuelve en processLandedRouteLegs() comparando el destino de
 * ESE VUELO contra el dest_iata (destino final) del propio envío:
 *   - Coinciden        → el envío llegó a destino → pasa a DELIVERED.
 *   - No coinciden      → el envío vuelve a PLANNED (ya tiene el siguiente
 *     vuelo asignado, no pasa por PENDING/planificador) y se le actualiza
 *     current_iata / current_since_utc al aeropuerto donde acaba de aterrizar.
 * En ambos casos el tramo cumplido se marca DELIVERED para no reprocesarlo.
 *
 * Nota: antes se comparaba el step_order del tramo contra el máximo step_order
 * de rutas existentes para el envío. Eso fallaba si un tramo futuro había sido
 * BORRADO por una cancelación (ver OpsFlightCancelService.releaseShipments):
 * al desaparecer el tramo siguiente, el tramo anterior pasaba a verse como
 * "el último" y el envío se marcaba DELIVERED en un aeropuerto intermedio en
 * vez de quedar disponible para que el planificador le arme el tramo real
 * hacia destino. Comparar contra dest_iata es inmune a ese borrado porque no
 * depende de cuántas rutas queden en BD.
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

		// Debe correr DESPUÉS de markLandedFlights (necesita flight.status = 'LANDED').
		LandedLegsResult result = processLandedRouteLegs(now);

		if (departed > 0 || landed > 0 || shipmentsInFlight > 0
				|| result.delivered() > 0 || result.advanced() > 0) {
			log.info("OpsFlightStatusService: {} vuelos a IN_FLIGHT, {} a LANDED, " +
					  "{} envíos a IN_FLIGHT, {} envíos a DELIVERED, {} envíos avanzan de tramo",
					departed, landed, shipmentsInFlight, result.delivered(), result.advanced());
		}
	}

	private record LandedLegsResult(int delivered, int advanced) {}

	/**
	 * Resuelve, tramo por tramo, los OpsShipmentRoute PENDING cuyo vuelo ya
	 * aterrizó (LANDED). Se compara el destino DE ESE VUELO contra el
	 * dest_iata (destino final) del propio envío — no el step_order — porque
	 * el step_order máximo se calcula sobre las rutas que quedan en BD, y una
	 * cancelación puede haber borrado el tramo siguiente (ver
	 * OpsFlightCancelService.releaseShipments), dejando un falso "último tramo".
	 */
	private LandedLegsResult processLandedRouteLegs(LocalDateTime now) {
		List<OpsShipmentRoute> landedLegs = routeRepo.findPendingRoutesWithLandedFlight();
		if (landedLegs.isEmpty()) {
			return new LandedLegsResult(0, 0);
		}

		int delivered = 0;
		int advanced = 0;

		List<OpsShipment> shipmentsToSave = new ArrayList<>();
		List<OpsShipmentRoute> routesToSave = new ArrayList<>();

		for (OpsShipmentRoute leg : landedLegs) {
			OpsShipment shipment = leg.getShipment();
			String legDest = leg.getFlight().getDestIata();

			if (legDest != null && legDest.equals(shipment.getDestIata())) {
				// El vuelo que acaba de aterrizar llega al destino final del envío.
				shipment.setStatus("DELIVERED");
				shipment.setCurrentIata(legDest);
				shipment.setCurrentSinceUtc(now);
				shipment.setLastUpdated(now);
				delivered++;
			} else {
				// Aterrizó en una escala intermedia, no en destino final.
				shipment.setCurrentIata(legDest);
				shipment.setCurrentSinceUtc(now);
				shipment.setLastUpdated(now);

				boolean tieneSiguienteTramo =
						routeRepo.existsOtherPendingLegForShipment(shipment.getId(), leg.getId());

				if (tieneSiguienteTramo) {
					// Caso normal: el siguiente tramo ya existe con vuelo asignado.
					// markShipmentsInFlight lo pasará a IN_FLIGHT cuando ese vuelo despegue.
					shipment.setStatus("PLANNED");
				} else {
					// El siguiente tramo NO existe (p. ej. fue borrado por una
					// cancelación mientras este tramo ya iba en vuelo). El envío
					// vuelve a PENDING para que OpsPlannerService lo recoja en el
					// próximo ciclo y le arme una ruta nueva desde current_iata
					// hacia dest_iata.
					shipment.setStatus("PENDING");
				}
				advanced++;
			}

			leg.setStatus("DELIVERED");
			shipmentsToSave.add(shipment);
			routesToSave.add(leg);
		}

		shipmentRepo.saveAll(shipmentsToSave);
		routeRepo.saveAll(routesToSave);

		return new LandedLegsResult(delivered, advanced);
	}

}