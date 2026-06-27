package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.CreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.dto.response.SimulationDto;
import pe.pucp.tasfb2b.service.KpiService;
import pe.pucp.tasfb2b.service.SimulationService;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/simulations")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;
    private final KpiService kpiService;

    @PostMapping
    public ResponseEntity<SimulationDto> create(@Valid @RequestBody CreateSimulationRequest req) {
        log.info("ACTION create_simulation scenario='{}' startDate={} algorithm={}", req.getScenarioType(), req.getStartDate(), req.getAlgorithm());
        SimulationDto dto = simulationService.createSimulation(req);
        log.info("ACTION create_simulation OK id={}", dto.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<SimulationDto>> findAll() {
        log.debug("ACTION list_simulations");
        return ResponseEntity.ok(simulationService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SimulationDto> getById(@PathVariable Long id) {
        log.debug("ACTION get_simulation id={}", id);
        return ResponseEntity.ok(simulationService.getSimulation(id));
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<SimulationDto> start(@PathVariable Long id) {
        log.info("ACTION start_simulation id={}", id);
        SimulationDto dto = simulationService.startSimulation(id);
        log.info("ACTION start_simulation OK id={} status={}", id, dto.getStatus());
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/{id}/pause")
    public ResponseEntity<SimulationDto> pause(@PathVariable Long id) {
        log.info("ACTION pause_simulation id={}", id);
        return ResponseEntity.ok(simulationService.pauseSimulation(id));
    }

    @PutMapping("/{id}/resume")
    public ResponseEntity<SimulationDto> resume(@PathVariable Long id) {
        log.info("ACTION resume_simulation id={}", id);
        return ResponseEntity.ok(simulationService.resumeSimulation(id));
    }

    @PutMapping("/{id}/stop")
    public ResponseEntity<SimulationDto> stop(@PathVariable Long id) {
        log.info("ACTION stop_simulation id={}", id);
        return ResponseEntity.ok(simulationService.stopSimulation(id));
    }

    @GetMapping("/{id}/kpis")
    public ResponseEntity<List<KpiDto>> getKpis(@PathVariable Long id) {
        log.debug("ACTION get_kpis simulationId={}", id);
        return ResponseEntity.ok(kpiService.findBySimulation(id));
    }

    @GetMapping("/active")
    public ResponseEntity<SimulationDto> getActive() {
        log.debug("ACTION get_active_simulation");
        return simulationService.findAll().stream()
                .filter(s -> "PLAYING".equals(s.getStatus())
                        || "PAUSED".equals(s.getStatus())
                        || "BUFFERING".equals(s.getStatus()))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @DeleteMapping("/reset")
    public ResponseEntity<Void> resetSimulations() {
        log.info("ACTION reset_simulations");
        simulationService.hardReset();
        return ResponseEntity.ok().build();
    }
}