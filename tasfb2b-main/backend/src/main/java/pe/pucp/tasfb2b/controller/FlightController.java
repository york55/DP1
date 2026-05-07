package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.dto.request.CancelFlightRequest;
import pe.pucp.tasfb2b.dto.response.FlightDto;
import pe.pucp.tasfb2b.service.FlightService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/flights")
@RequiredArgsConstructor
public class FlightController {

    private final FlightService flightService;

    @GetMapping
    public ResponseEntity<List<FlightDto>> findAll(
            @RequestParam(required = false) String status) {
        if (status != null) {
            return ResponseEntity.ok(flightService.findByStatus(FlightStatus.valueOf(status)));
        }
        return ResponseEntity.ok(flightService.findAll());
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<FlightDto> cancel(@PathVariable Long id,
                                             @RequestBody CancelFlightRequest req) {
        return ResponseEntity.ok(flightService.cancelFlight(id, req.getReason(), null));
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(flightService.uploadFlights(file));
    }
}
