package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.AirportRequest;
import pe.pucp.tasfb2b.dto.response.AirportDto;
import pe.pucp.tasfb2b.service.AirportService;

import java.util.List;

@RestController
@RequestMapping("/api/airports")
@RequiredArgsConstructor
public class AirportController {

    private final AirportService airportService;

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
}

