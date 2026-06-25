package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.dto.response.OpsMapResponse;
import pe.pucp.tasfb2b.dto.response.OpsMapResponse.*;
import pe.pucp.tasfb2b.dto.response.OpsShipmentResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OpsMapService {

    private final OpsAirportRepository    airportRepo;
    private final OpsFlightRepository     flightRepo;
    private final OpsShipmentRouteRepository routeRepo;
    private final OpsShipmentRepository   shipmentRepo;

    /**
     * Estados de OPS_SHIPMENT que cuentan como "físicamente en el almacén de origen".
     * Solo PENDING: una vez planificado (PLANNED) o volando (IN_FLIGHT), el envío
     * ocupa espacio en el vuelo asignado, no en el almacén del aeropuerto.
     */
    private static final List<String> STATUSES_OCCUPYING_WAREHOUSE = List.of("PENDING");

    /** Minutos que un envío DELIVERED sigue ocupando espacio físico en el almacén de destino. */
    private static final int DELIVERED_OCCUPANCY_MINUTES = 15;

    @Transactional(readOnly = true)
    public OpsMapResponse buildSnapshot() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        // ── Vuelos que tienen al menos un envío asignado ───────────────────────
        List<OpsFlight> activeFlights = flightRepo.findFlightsWithPendingShipments();

        // ── AGREGADO: cancelados de hoy y mañana (para mostrar en el tab) ─────
        List<OpsFlight> cancelledFlights = flightRepo.findRecentlyCancelled(
                now.toLocalDate(), now.toLocalDate().plusDays(1));

        // Lista combinada para construir los DTOs (cancelados van al final)
        List<OpsFlight> allDisplayFlights = new java.util.ArrayList<>(activeFlights);
        allDisplayFlights.addAll(cancelledFlights);

        // ── Sumar los bagCount de los envíos asignados a cada vuelo ────────────
        Map<Long, Integer> bagsPerFlight = computeBagsPerFlight(activeFlights);

        // ── Aeropuertos con ocupación calculada ───────────────────────────────
        List<OpsAirport> allAirports = airportRepo.findAll();

        // Ocupación = lo que sigue en el almacén de ORIGEN (PENDING)
        //           + lo recién entregado en el almacén de DESTINO (DELIVERED hace <15 min)
        Map<String, Integer> shipmentsByOrigin = new HashMap<>(countWarehouseOccupancyByOrigin());
        countRecentlyDeliveredByDest(now).forEach((iata, bags) ->
                shipmentsByOrigin.merge(iata, bags, Integer::sum));

        List<AirportDto> airportDtos = allAirports.stream()
                .map(a -> {
                    int assigned = shipmentsByOrigin.getOrDefault(a.getIataCode(), 0);
                    double pct   = a.getCapacity() != null && a.getCapacity() > 0
                            ? Math.min(100.0, (double) assigned / a.getCapacity() * 100.0)
                            : 0.0;
                    return AirportDto.builder()
                            .iataCode(a.getIataCode())
                            .name(a.getName())
                            .country(a.getCountry())
                            .latitude(a.getLatitude() != null ? a.getLatitude() : 0.0)
                            .longitude(a.getLongitude() != null ? a.getLongitude() : 0.0)
                            .capacity(a.getCapacity() != null ? a.getCapacity() : 0)
                            .assignedShipments(assigned)
                            .occupancyPct(pct)
                            .build();
                })
                .collect(Collectors.toList());

        // ── Lookup de aeropuertos por IATA para resolver origin/dest de cada vuelo ──
        Map<String, OpsAirport> airportsByIata = allAirports.stream()
                .collect(Collectors.toMap(OpsAirport::getIataCode, a -> a));

        // ── DTOs de vuelos activos ─────────────────────────────────────────────
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        Map<Long, Integer> finalBagsMap = bagsPerFlight;

        List<ActiveFlightDto> flightDtos = allDisplayFlights.stream()
                .map(f -> {
                    OpsAirport orig = airportsByIata.get(f.getOriginIata());
                    OpsAirport dest = airportsByIata.get(f.getDestIata());
                    return ActiveFlightDto.builder()
                            .flightId(f.getId())
                            .originIata(f.getOriginIata())
                            .destIata(f.getDestIata())
                            .originName(orig != null ? orig.getName() : "")
                            .destName(dest != null ? dest.getName() : "")
                            .originLat(orig != null && orig.getLatitude() != null ? orig.getLatitude() : 0.0)
                            .originLng(orig != null && orig.getLongitude() != null ? orig.getLongitude() : 0.0)
                            .destLat(dest != null && dest.getLatitude() != null ? dest.getLatitude() : 0.0)
                            .destLng(dest != null && dest.getLongitude() != null ? dest.getLongitude() : 0.0)
                            .progress(f.getProgress(now))
                            .status(f.getStatus())
                            .depTimeUtc(f.getDepTimeUtc().format(fmt))
                            .arrTimeUtc(f.getArrTimeUtc().format(fmt))
                            .capacity(f.getCapacity())
                            .assignedBags(finalBagsMap.getOrDefault(f.getId(), 0))
                            .build();
                })
                .collect(Collectors.toList());

        List<OpsShipmentResponse> shipmentDtos =
                shipmentRepo.findAll()
                        .stream()
                        .map(s -> new OpsShipmentResponse(
                                s.getId(),
                                s.getExternalId(),
                                s.getOriginIata(),
                                s.getDestIata(),
                                s.getBagCount(),
                                s.getStatus(),
                                s.getRegisteredAt(),
                                s.getDeadlineUtc(),
                                s.getLastUpdated()
                        ))
                        .collect(Collectors.toList());

        return OpsMapResponse.builder()
                .airports(airportDtos)
                .flights(flightDtos)
                .shipments(shipmentDtos)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Suma los bagCount de los envíos asignados a cada vuelo.
     * Hace una sola consulta a OPS_SHIPMENT_ROUTE y agrupa en memoria.
     */
    private Map<Long, Integer> computeBagsPerFlight(List<OpsFlight> flights) {
        Map<Long, Integer> result = new HashMap<>();
        if (flights.isEmpty()) return result;

        for (OpsFlight f : flights) {
            int bags = routeRepo.findAll().stream()
                    .filter(r -> r.getFlight() != null && r.getFlight().getId().equals(f.getId()))
                    .filter(r -> "PENDING".equals(r.getStatus()))
                    .mapToInt(r -> r.getShipment() != null ? r.getShipment().getBagCount() : 0)
                    .sum();
            result.put(f.getId(), bags);
        }
        return result;
    }

    /** Cuenta envíos PLANNED o IN_TRANSIT agrupados por aeropuerto origen. */
    private Map<String, Integer> countPlannedShipmentsByOrigin() {
        return shipmentRepo.findAllByStatus("PLANNED").stream()
                .collect(Collectors.groupingBy(
                        OpsShipment::getOriginIata,
                        Collectors.summingInt(OpsShipment::getBagCount)));
    }

    /**
     * Cuenta maletas que siguen físicamente en el almacén de origen, agrupadas por aeropuerto.
     * A diferencia de countPlannedShipmentsByOrigin(), incluye también PENDING (recién
     * registrado, aún no planificado), porque esas maletas ya ocupan espacio real en el
     * almacén aunque todavía no tengan vuelo asignado.
     */
    private Map<String, Integer> countWarehouseOccupancyByOrigin() {
        return shipmentRepo.findAllByStatusIn(STATUSES_OCCUPYING_WAREHOUSE).stream()
                .collect(Collectors.groupingBy(
                        OpsShipment::getOriginIata,
                        Collectors.summingInt(OpsShipment::getBagCount)));
    }

    /**
     * Maletas entregadas (DELIVERED) hace menos de DELIVERED_OCCUPANCY_MINUTES minutos:
     * siguen ocupando espacio físico en el almacén de destino aunque ya cambiaron de estado.
     * Usa lastUpdated como proxy del "momento de entrega", ya que markShipmentsDelivered()
     * actualiza ese campo junto con el status.
     */
    private Map<String, Integer> countRecentlyDeliveredByDest(LocalDateTime now) {
        LocalDateTime cutoff = now.minusMinutes(DELIVERED_OCCUPANCY_MINUTES);
        return shipmentRepo.findAllByStatusAndLastUpdatedAfter("DELIVERED", cutoff).stream()
                .collect(Collectors.groupingBy(
                        OpsShipment::getDestIata,
                        Collectors.summingInt(OpsShipment::getBagCount)));
    }
}