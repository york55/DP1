package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.ActiveFlightResponse;
import pe.pucp.tasfb2b.service.OpsFlightPlanService;

import java.util.List;

@RestController
@RequestMapping("/api/flight-ops")
@RequiredArgsConstructor
public class FlightOperationsController {

    private final OpsFlightPlanService flightPlanService;

    @GetMapping
    public ResponseEntity<List<ActiveFlightResponse>> getAll() {
        return ResponseEntity.ok(flightPlanService.getAllFlights());
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable Long id) {
        boolean cancelled = flightPlanService.cancelFlight(id);
        return cancelled ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }
}