package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.Route;
import pe.pucp.tasfb2b.domain.RouteLeg;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.dto.response.RouteLegDto;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;
import pe.pucp.tasfb2b.repository.RouteRepository;
import pe.pucp.tasfb2b.service.ShipmentService;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ShipmentController {

    private final ShipmentService shipmentService;
    private final RouteRepository routeRepo;

    @GetMapping("/shipments")
    public ResponseEntity<?> findShipments(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long simulationId) {

        log.debug("ACTION list_shipments status={} simulationId={}", status, simulationId);
        if (status != null) {
            try {
                BatchStatus batchStatus = BatchStatus.valueOf(status);
                return ResponseEntity.ok(shipmentService.findAllByBatchStatus(batchStatus));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Estado desconocido: " + status));
            }
        }
        return ResponseEntity.ok(shipmentService.findAll());
    }

    @GetMapping("/shipments/{id}/status")
    public ResponseEntity<ShipmentDto> getStatus(@PathVariable Long id) {
        log.debug("ACTION get_shipment_status id={}", id);
        return ResponseEntity.ok(shipmentService.findById(id));
    }

    @GetMapping("/shipments/{id}/route")
    public ResponseEntity<?> getRoute(@PathVariable Long id) {
        log.debug("ACTION get_shipment_route id={}", id);
        try {
            return ResponseEntity.ok(shipmentService.getRoute(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    /*@PostMapping("/batches/upload")
    public ResponseEntity<Map<String, Object>> uploadBatches(
            @RequestParam("file") MultipartFile file) {
        try {
            byte[] fileBytes = file.getBytes();
            String filename = file.getOriginalFilename();
            shipmentService.uploadBatchesAsync(fileBytes, filename);
            return ResponseEntity.status(202).body(Map.of("message", "Carga asíncrona iniciada"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }*/
    @PostMapping("/batches/from-store")
    public ResponseEntity<Map<String, Object>> fromStore(
            @RequestParam("periodo") int periodo,
            @RequestParam("startDate")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime startDate) {

        log.info("ACTION from_store periodo={} startDate={}", periodo, startDate);
        shipmentService.crearBatchesDesdeStoreAsync(periodo, startDate);
        return ResponseEntity.status(202).body(Map.of("mensaje", "Creación de batches iniciada"));
    }

    // NUEVO: usa archivos en disco en lugar del EnvioStore en memoria
    @PostMapping("/batches/from-files")
    public ResponseEntity<Map<String, Object>> fromFiles(
            @RequestParam("periodo") int periodo,
            @RequestParam("startDate")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime startDate) {

        log.info("ACTION from_files periodo={} startDate={}", periodo, startDate);
        shipmentService.crearBatchesDesdeArchivosAsync(periodo, startDate);
        return ResponseEntity.status(202).body(Map.of("mensaje", "Creación de batches desde archivos iniciada"));
    }

   @PostMapping("/batches/upload")
    public ResponseEntity<Map<String, Object>> uploadBatches(
            @RequestParam("file") MultipartFile file,
            @RequestParam("periodo") int periodo,
            @RequestParam("startDate")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime startDate) {

        log.info("ACTION upload_batches file='{}' periodo={} startDate={}", file.getOriginalFilename(), periodo, startDate);
        try {
            byte[] fileBytes = file.getBytes();
            String filename = file.getOriginalFilename();

            shipmentService.uploadBatchesAsync(
                    fileBytes,
                    filename,
                    periodo,
                    startDate
            );

            log.info("ACTION upload_batches OK async task started file='{}'", filename);
            return ResponseEntity.status(202)
                    .body(Map.of("message", "Carga asíncrona iniciada"));

        } catch (Exception e) {
            log.error("ACTION upload_batches ERROR file='{}' error='{}'", file.getOriginalFilename(), e.getMessage());
            return ResponseEntity.status(500)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Returns completed routes (DELIVERED/DELAYED shipments with no PENDING/IN_FLIGHT legs)
     * including all leg details with flight and airport info.
     */
    @GetMapping("/routes/completed")
    public ResponseEntity<List<Map<String, Object>>> getCompletedRoutes() {
        log.debug("ACTION get_completed_routes");
        List<Route> routes = routeRepo.findCompletedRoutesWithLegs();

        List<Map<String, Object>> result = routes.stream().map(r -> {
            var batch = r.getShipment().getBaggageBatch();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("routeId", r.getId());
            m.put("shipmentId", r.getShipment().getId());
            m.put("shipmentStatus", r.getShipment().getStatus().name());
            m.put("batchId", batch.getId());
            m.put("quantity", batch.getQuantity());
            m.put("origin", batch.getOriginAirport().getIataCode());
            m.put("destination", batch.getDestinationAirport().getIataCode());
            m.put("airline", batch.getAirline() != null ? batch.getAirline().getIataCode() : null);
            m.put("totalLegs", r.getTotalLegs());
            m.put("estimatedArrival", r.getEstimatedArrival() != null ? r.getEstimatedArrival().toString() : null);
            m.put("actualArrival", r.getActualArrival() != null ? r.getActualArrival().toString() : null);
            m.put("deliveredAt", r.getShipment().getDeliveredAt() != null ? r.getShipment().getDeliveredAt().toString() : null);
            m.put("deadline", r.getShipment().getDeadline() != null ? r.getShipment().getDeadline().toString() : null);

            List<Map<String, Object>> legs = r.getLegs().stream()
                    .sorted(Comparator.comparingInt(RouteLeg::getLegOrder))
                    .map(rl -> {
                        Map<String, Object> lm = new LinkedHashMap<>();
                        lm.put("legOrder", rl.getLegOrder());
                        lm.put("status", rl.getStatus().name());
                        lm.put("flightId", rl.getFlight().getId());
                        lm.put("flightOrigin", rl.getFlight().getOriginAirport().getIataCode());
                        lm.put("flightDestination", rl.getFlight().getDestinationAirport().getIataCode());
                        lm.put("departureTime", rl.getFlight().getDepartureTime() != null ? rl.getFlight().getDepartureTime().toString() : null);
                        lm.put("arrivalTime", rl.getFlight().getArrivalTime() != null ? rl.getFlight().getArrivalTime().toString() : null);
                        return lm;
                    }).collect(Collectors.toList());
            m.put("legs", legs);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}