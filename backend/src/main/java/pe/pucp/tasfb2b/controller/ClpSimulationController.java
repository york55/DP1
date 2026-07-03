package pe.pucp.tasfb2b.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.ClpCreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.ClpSimulationDto;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.service.ClpKpiService;
import pe.pucp.tasfb2b.service.ClpSimulationService;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/clp/simulations")
@RequiredArgsConstructor
public class ClpSimulationController {

    private final ClpSimulationService simulationService;
    private final ClpKpiService kpiService;

    @PostMapping
    public ResponseEntity<ClpSimulationDto> create(@Valid @RequestBody ClpCreateSimulationRequest req) {
        log.info("[CLP] ACTION create_simulation startDate={} algorithm={}", req.getStartDate(), req.getAlgorithm());
        ClpSimulationDto dto = simulationService.createSimulation(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<ClpSimulationDto>> findAll() {
        return ResponseEntity.ok(simulationService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClpSimulationDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(simulationService.getSimulation(id));
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<ClpSimulationDto> start(@PathVariable Long id) {
        log.info("[CLP] ACTION start_simulation id={}", id);
        return ResponseEntity.ok(simulationService.startSimulation(id));
    }

    @PutMapping("/{id}/pause")
    public ResponseEntity<ClpSimulationDto> pause(@PathVariable Long id) {
        log.info("[CLP] ACTION pause_simulation id={}", id);
        return ResponseEntity.ok(simulationService.pauseSimulation(id));
    }

    @PutMapping("/{id}/resume")
    public ResponseEntity<ClpSimulationDto> resume(@PathVariable Long id) {
        log.info("[CLP] ACTION resume_simulation id={}", id);
        return ResponseEntity.ok(simulationService.resumeSimulation(id));
    }

    @PutMapping("/{id}/stop")
    public ResponseEntity<ClpSimulationDto> stop(@PathVariable Long id) {
        log.info("[CLP] ACTION stop_simulation id={}", id);
        return ResponseEntity.ok(simulationService.stopSimulation(id));
    }

    @GetMapping("/{id}/kpis")
    public ResponseEntity<List<KpiDto>> getKpis(@PathVariable Long id) {
        return ResponseEntity.ok(kpiService.findBySimulation(id));
    }

    @GetMapping("/active")
    public ResponseEntity<ClpSimulationDto> getActive() {
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
        log.info("[CLP] ACTION reset_simulations");
        simulationService.hardReset();
        return ResponseEntity.ok().build();
    }
}
