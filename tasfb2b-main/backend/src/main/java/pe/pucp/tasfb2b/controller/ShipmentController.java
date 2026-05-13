package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;
import pe.pucp.tasfb2b.service.ShipmentService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ShipmentController {

    private final ShipmentService shipmentService;

    @GetMapping("/shipments")
    public ResponseEntity<?> findShipments(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long simulationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        if (status != null) {
            Pageable pageable = PageRequest.of(page, size);
            Page<ShipmentDto> result = shipmentService.findByStatus(
                    ShipmentStatus.valueOf(status), pageable);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.ok(shipmentService.findAll());
    }

    @GetMapping("/shipments/{id}/status")
    public ResponseEntity<ShipmentDto> getStatus(@PathVariable Long id) {
        return ResponseEntity.ok(shipmentService.findById(id));
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
   @PostMapping("/batches/upload")
    public ResponseEntity<Map<String, Object>> uploadBatches(
            @RequestParam("file") MultipartFile file,
            @RequestParam("periodo") int periodo,
            @RequestParam("startDate")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime startDate) {

        try {
            byte[] fileBytes = file.getBytes();
            String filename = file.getOriginalFilename();

            shipmentService.uploadBatchesAsync(
                    fileBytes,
                    filename,
                    periodo,
                    startDate
            );

            return ResponseEntity.status(202)
                    .body(Map.of("message", "Carga asíncrona iniciada"));

        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
