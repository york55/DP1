package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.FlightPlanResponse;
import pe.pucp.tasfb2b.service.FlightPlanService;

import java.util.List;

@RestController
@RequestMapping("/api/flight-plans")
@RequiredArgsConstructor
public class FlightPlanController {

    private final FlightPlanService flightPlanService;

    @GetMapping
    public ResponseEntity<List<FlightPlanResponse>> getAll() {
        return ResponseEntity.ok(flightPlanService.getFlightPlans());
    }
}