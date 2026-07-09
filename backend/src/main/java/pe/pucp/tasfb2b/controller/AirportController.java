package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.RouteLeg;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.RouteLegStatus;
import pe.pucp.tasfb2b.dto.request.AirportRequest;
import pe.pucp.tasfb2b.dto.response.AirportDto;
import pe.pucp.tasfb2b.repository.BaggageBatchRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;
import pe.pucp.tasfb2b.repository.RouteLegRepository;
import pe.pucp.tasfb2b.service.AirportService;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/airports")
@RequiredArgsConstructor
public class AirportController {

    private final AirportService airportService;
    private final BaggageBatchRepository batchRepo;
    private final FlightRepository flightRepo;
    private final RouteLegRepository routeLegRepo;

    @Value("${tasf.simulation.default-threshold-amber:75}")
    private double thresholdAmber;

    @Value("${tasf.simulation.default-threshold-red:90}")
    private double thresholdRed;

    @GetMapping
    public ResponseEntity<List<AirportDto>> findAll() {
        return ResponseEntity.ok(airportService.findAll(thresholdAmber, thresholdRed));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AirportDto> findById(@PathVariable Long id) {
        return ResponseEntity.ok(airportService.findById(id, thresholdAmber, thresholdRed));
    }

    @PostMapping
    public ResponseEntity<AirportDto> create(@Valid @RequestBody AirportRequest request) {
        AirportDto created = airportService.create(request, thresholdAmber, thresholdRed);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AirportDto> update(@PathVariable Long id,
                                              @Valid @RequestBody AirportRequest request) {
        return ResponseEntity.ok(airportService.update(id, request, thresholdAmber, thresholdRed));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        airportService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns warehouse detail for a given airport IATA code:
     * - stock: batches currently at this airport (origin IN_ORIGIN + transit hub batches)
     * - plannedIncoming: flights arriving + their batches
     * - plannedOutgoing: flights departing + their batches
     */
    @GetMapping("/iata/{iata}/warehouse-detail")
    public ResponseEntity<Map<String, Object>> getWarehouseDetail(@PathVariable String iata) {
        log.debug("ACTION warehouse_detail iata={}", iata);

        // 1. Stock: batches whose origin is this airport and are IN_ORIGIN
        List<BaggageBatch> originBatches = batchRepo.findAllWithAirports().stream()
                .filter(b -> b.getOriginAirport().getIataCode().equals(iata) && b.getStatus() == BatchStatus.IN_ORIGIN)
                .collect(Collectors.toList());

        // 1b. Transit hub batches: IN_TRANSIT batches waiting at this airport (not on a plane)
        List<RouteLeg> transitLegs = routeLegRepo.findFirstPendingLegsOfTransitBagsAtIntermediateStops().stream()
                .filter(rl -> rl.getFlight().getOriginAirport().getIataCode().equals(iata))
                .collect(Collectors.toList());

        // 1c. Delivered batches whose destination is this airport
        List<BaggageBatch> deliveredBatches = batchRepo.findAllWithAirports().stream()
                .filter(b -> b.getDestinationAirport().getIataCode().equals(iata) && b.getStatus() == BatchStatus.DELIVERED)
                .collect(Collectors.toList());

        List<Map<String, Object>> stock = new ArrayList<>();
        for (BaggageBatch b : originBatches) {
            stock.add(batchToMap(b, "EN_ORIGEN"));
        }
        for (RouteLeg rl : transitLegs) {
            BaggageBatch b = rl.getRoute().getShipment().getBaggageBatch();
            stock.add(batchToMap(b, "EN_TRANSITO"));
        }
        for (BaggageBatch b : deliveredBatches) {
            stock.add(batchToMap(b, "ENTREGADO"));
        }

        // 2. Planned incoming: SCHEDULED/IN_FLIGHT flights with destination = iata
        List<Flight> inFlights = flightRepo.findAllWithAirports().stream()
                .filter(f -> f.getDestinationAirport().getIataCode().equals(iata)
                        && (f.getStatus() == FlightStatus.SCHEDULED || f.getStatus() == FlightStatus.IN_FLIGHT))
                .collect(Collectors.toList());

        List<Map<String, Object>> incoming = new ArrayList<>();
        for (Flight f : inFlights) {
            var pendingLegs = routeLegRepo.findByFlightIdAndStatusWithBatch(f.getId(), RouteLegStatus.PENDING);
            var inFlightLegs = routeLegRepo.findByFlightIdAndStatusWithBatch(f.getId(), RouteLegStatus.IN_FLIGHT);
            List<Map<String, Object>> batches = new ArrayList<>();
            for (RouteLeg rl : pendingLegs) batches.add(legBatchToMap(rl));
            for (RouteLeg rl : inFlightLegs) batches.add(legBatchToMap(rl));
            incoming.add(flightWithBatchesMap(f, batches));
        }

        // 3. Planned outgoing: SCHEDULED flights with origin = iata
        List<Flight> outFlights = flightRepo.findAllWithAirports().stream()
                .filter(f -> f.getOriginAirport().getIataCode().equals(iata)
                        && f.getStatus() == FlightStatus.SCHEDULED)
                .collect(Collectors.toList());

        List<Map<String, Object>> outgoing = new ArrayList<>();
        for (Flight f : outFlights) {
            var pendingLegs = routeLegRepo.findByFlightIdAndStatusWithBatch(f.getId(), RouteLegStatus.PENDING);
            List<Map<String, Object>> batches = new ArrayList<>();
            for (RouteLeg rl : pendingLegs) batches.add(legBatchToMap(rl));
            outgoing.add(flightWithBatchesMap(f, batches));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("iata", iata);
        result.put("stock", stock);
        result.put("incoming", incoming);
        result.put("outgoing", outgoing);
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> batchToMap(BaggageBatch b, String warehouseStatus) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("batchId", b.getId());
        m.put("quantity", b.getQuantity());
        m.put("origin", b.getOriginAirport().getIataCode());
        m.put("destination", b.getDestinationAirport().getIataCode());
        m.put("status", b.getStatus().name());
        m.put("warehouseStatus", warehouseStatus);
        m.put("airline", b.getAirline() != null ? b.getAirline().getIataCode() : null);
        return m;
    }

    private Map<String, Object> legBatchToMap(RouteLeg rl) {
        BaggageBatch b = rl.getRoute().getShipment().getBaggageBatch();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("batchId", b.getId());
        m.put("quantity", b.getQuantity());
        m.put("origin", b.getOriginAirport().getIataCode());
        m.put("destination", b.getDestinationAirport().getIataCode());
        m.put("airline", b.getAirline() != null ? b.getAirline().getIataCode() : null);
        return m;
    }

    private Map<String, Object> flightWithBatchesMap(Flight f, List<Map<String, Object>> batches) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("flightId", f.getId());
        m.put("origin", f.getOriginAirport().getIataCode());
        m.put("destination", f.getDestinationAirport().getIataCode());
        m.put("status", f.getStatus().name());
        m.put("departureTime", f.getDepartureTime() != null ? f.getDepartureTime().toString() : null);
        m.put("arrivalTime", f.getArrivalTime() != null ? f.getArrivalTime().toString() : null);
        m.put("capacity", f.getBaggageCapacity());
        m.put("currentLoad", f.getCurrentLoad());
        m.put("totalBatchBags", batches.stream().mapToInt(b -> (int) b.getOrDefault("quantity", 0)).sum());
        m.put("batches", batches);
        return m;
    }
}
