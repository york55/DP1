package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.CreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.dto.response.SimulationDto;
import pe.pucp.tasfb2b.service.KpiService;
import pe.pucp.tasfb2b.service.SimulationService;

import java.util.List;

@RestController
@RequestMapping("/api/simulations")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;
    private final KpiService kpiService;

    @PostMapping
    public ResponseEntity<SimulationDto> create(@Valid @RequestBody CreateSimulationRequest req) {
        SimulationDto dto = simulationService.createSimulation(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<SimulationDto>> findAll() {
        return ResponseEntity.ok(simulationService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SimulationDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.getSimulation(id));
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<SimulationDto> start(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.startSimulation(id));
    }

    @PutMapping("/{id}/pause")
    public ResponseEntity<SimulationDto> pause(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.pauseSimulation(id));
    }

    @PutMapping("/{id}/resume")
    public ResponseEntity<SimulationDto> resume(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.resumeSimulation(id));
    }

    @PutMapping("/{id}/stop")
    public ResponseEntity<SimulationDto> stop(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.stopSimulation(id));
    }

    @GetMapping("/{id}/kpis")
    public ResponseEntity<List<KpiDto>> getKpis(@PathVariable Long id) {
        return ResponseEntity.ok(kpiService.findBySimulation(id));
    }
}
