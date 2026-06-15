package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.dto.request.CancelFlightRequest;
import pe.pucp.tasfb2b.dto.request.FlightRequest;
import pe.pucp.tasfb2b.dto.response.FlightDto;
import pe.pucp.tasfb2b.service.FlightService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/flights")
@RequiredArgsConstructor
public class FlightController {

    private final FlightService flightService;

    @GetMapping
    public ResponseEntity<List<FlightDto>> findAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "false") boolean assignedOnly,
            @RequestParam(required = false) String date) {
        log.debug("ACTION list_flights status={} assignedOnly={} date={}", status, assignedOnly, date);
        if (date != null) {
            return ResponseEntity.ok(flightService.findByDate(LocalDate.parse(date)));
        }
        if (status != null) {
            return ResponseEntity.ok(assignedOnly
                    ? flightService.findByStatusAssigned(FlightStatus.valueOf(status))
                    : flightService.findByStatus(FlightStatus.valueOf(status)));
        }
        return ResponseEntity.ok(assignedOnly
                ? flightService.findAllAssigned()
                : flightService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<FlightDto> findById(@PathVariable Long id) {
        log.debug("ACTION get_flight id={}", id);
        return ResponseEntity.ok(flightService.findById(id));
    }

    @PostMapping
    public ResponseEntity<FlightDto> create(@Valid @RequestBody FlightRequest request) {
        log.info("ACTION create_flight request={}", request);
        FlightDto created = flightService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<FlightDto> update(@PathVariable Long id,
                                            @Valid @RequestBody FlightRequest request) {
        log.info("ACTION update_flight id={} request={}", id, request);
        return ResponseEntity.ok(flightService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("ACTION delete_flight id={}", id);
        flightService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<FlightDto> cancel(@PathVariable Long id,
                                             @RequestBody CancelFlightRequest req) {
        log.info("ACTION cancel_flight id={} reason='{}'", id, req.getReason());
        FlightDto dto = flightService.cancelFlight(id, req.getReason(), null);
        log.info("ACTION cancel_flight OK id={} status={}", id, dto.getStatus());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        log.info("ACTION upload_flights file='{}'", file.getOriginalFilename());
        Map<String, Object> result = flightService.uploadFlights(file);
        log.info("ACTION upload_flights OK result={}", result);
        return ResponseEntity.status(201).body(result);
    }
}
