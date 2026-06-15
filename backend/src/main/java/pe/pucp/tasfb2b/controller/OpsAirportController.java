package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.OpsAirportResponse;
import pe.pucp.tasfb2b.service.OpsAirportService;

import java.util.List;

@RestController
@RequestMapping("/api/ops/airports")
@RequiredArgsConstructor
public class OpsAirportController {

    private final OpsAirportService airportService;

    @GetMapping
    public ResponseEntity<List<OpsAirportResponse>> getAll() {
        return ResponseEntity.ok(airportService.getAll());
    }
}