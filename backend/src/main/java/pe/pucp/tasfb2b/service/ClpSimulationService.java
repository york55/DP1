package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.dto.request.ClpCreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.ClpSimulationDto;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.simulation.ClpBlockOrchestrator;
import pe.pucp.tasfb2b.simulation.ClpSimulationEngine;
import pe.pucp.tasfb2b.simulation.EnvioStore;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClpSimulationService {

    private final ClpSimulationRepository simulationRepo;
    private final ClpFlightRepository flightRepo;
    private final ClpFlightCancellationRepository cancellationRepo;
    private final ClpShipmentRepository shipmentRepo;
    private final ClpBaggageBatchRepository batchRepo;
    private final ClpAirportRepository airportRepo;
    private final ClpSimulationEngine simulationEngine;
    private final ClpBlockOrchestrator blockOrchestrator;
    private final ClpKpiService kpiService;
    private final ClpRouteRepository routeRepo;
    private final ClpRouteLegRepository routeLegRepo;
    private final ClpShipmentStatusHistoryRepository statusHistoryRepo;
    private final ClpKpiSnapshotRepository kpiSnapshotRepo;

    @Transactional
    public ClpSimulationDto createSimulation(ClpCreateSimulationRequest req) {
        ClpSimulation sim = new ClpSimulation();
        sim.setScenarioType(ScenarioType.COLLAPSE);
        sim.setStartDate(req.getStartDate());
        sim.setCancellationRate(BigDecimal.valueOf(req.getCancellationRate()));
        sim.setSeed(req.getSeed());
        sim.setVolumePerDay(req.getVolumePerDay());
        sim.setAlgorithm(req.getAlgorithm() != null ? req.getAlgorithm() : "ALNS");
        sim.setStatus(SimulationStatus.CONFIGURED);

        if (req.getAlnsParams() != null) {
            var ap = req.getAlnsParams();
            sim.setT0(ap.getT0());
            sim.setAlphaSa(ap.getAlpha());
            sim.setQPct(ap.getQPct());
            sim.setMaxIterations(ap.getMaxIterations());
        }

        ClpSimulation saved = simulationRepo.save(sim);
        log.info("[CLP] Simulación de colapso creada: id={}, algoritmo={}", saved.getId(), saved.getAlgorithm());
        return toDto(saved, null);
    }

    public ClpSimulationDto getSimulation(Long id) {
        ClpSimulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Simulación de colapso no encontrada: " + id));
        KpiDto kpi = kpiService.getLatest(id);
        return toDto(sim, kpi);
    }

    @Transactional
    public ClpSimulationDto startSimulation(Long id) {
        ClpSimulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Simulación de colapso no encontrada: " + id));

        if (sim.getStatus() != SimulationStatus.CONFIGURED) {
            throw new IllegalArgumentException("La simulación no puede iniciarse en estado: " + sim.getStatus());
        }

        resetForSimulation(sim);
        sim.setStatus(SimulationStatus.BUFFERING);
        simulationRepo.save(sim);
        simulationEngine.initSimulation(id);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.start(id);
            }
        });

        log.info("[CLP] Simulación {} iniciada — pipeline arrancando", id);
        return toDto(sim, null);
    }

    @Transactional
    public ClpSimulationDto pauseSimulation(Long id) {
        ClpSimulation sim = simulationRepo.findById(id).orElseThrow();
        blockOrchestrator.pause(id);
        sim.setStatus(SimulationStatus.PAUSED);
        simulationRepo.save(sim);
        return toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public ClpSimulationDto resumeSimulation(Long id) {
        ClpSimulation sim = simulationRepo.findById(id).orElseThrow();
        if (sim.getStatus() != SimulationStatus.PAUSED) {
            throw new IllegalArgumentException("Solo se puede reanudar una simulación pausada");
        }
        sim.setStatus(SimulationStatus.PLAYING);
        simulationRepo.save(sim);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.resume(id);
            }
        });

        return toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public ClpSimulationDto stopSimulation(Long id) {
        ClpSimulation sim = simulationRepo.findById(id).orElseThrow();
        blockOrchestrator.stop(id);
        simulationEngine.removeState(id);
        sim.setStatus(SimulationStatus.FINISHED);
        simulationRepo.save(sim);
        return toDto(sim, kpiService.getLatest(id));
    }

    public List<ClpSimulationDto> findAll() {
        return simulationRepo.findAll().stream()
                .map(s -> toDto(s, null))
                .collect(Collectors.toList());
    }

    private void resetForSimulation(ClpSimulation sim) {
        statusHistoryRepo.deleteAllInBatch();
        routeLegRepo.deleteAllInBatch();
        routeRepo.deleteAllInBatch();
        shipmentRepo.deleteAllInBatch();
        batchRepo.deleteAllInBatch();
        kpiSnapshotRepo.deleteAllInBatch();

        airportRepo.resetAllOccupancies();

        // Delete instance flights from previous collapse run
        List<ClpFlight> instances = flightRepo.findByFrequency("INSTANCE");
        if (!instances.isEmpty()) {
            cancellationRepo.deleteByFlightIdIn(instances.stream().map(ClpFlight::getId).toList());
            flightRepo.deleteAllInstances();
        }

        // Reset template flights
        List<ClpFlight> templates = flightRepo.findByFrequency("DAILY");
        cancellationRepo.deleteByFlightIdIn(templates.stream().map(ClpFlight::getId).toList());
        templates.forEach(f -> { f.setStatus(FlightStatus.SCHEDULED); f.setCurrentLoad(0); });
        flightRepo.saveAll(templates);

        log.info("[CLP] Reset completado para simulación {}", sim.getId());
    }

    @Transactional
    public void hardReset() {
        log.info("[CLP] Hard reset de tablas de colapso");
        statusHistoryRepo.deleteAllInBatch();
        routeLegRepo.deleteAllInBatch();
        routeRepo.deleteAllInBatch();
        shipmentRepo.deleteAllInBatch();
        batchRepo.deleteAllInBatch();
        kpiSnapshotRepo.deleteAllInBatch();
        cancellationRepo.deleteAllInBatch();
        simulationRepo.deleteAllInBatch();
        airportRepo.resetAllOccupancies();
        flightRepo.deleteAllInstances();

        List<ClpFlight> templates = flightRepo.findByFrequency("DAILY");
        for (ClpFlight f : templates) {
            f.setStatus(FlightStatus.SCHEDULED);
            f.setCurrentLoad(0);
        }
        flightRepo.saveAll(templates);
        log.info("[CLP] Hard reset COMPLETADO");
    }

    // ── DTO mapping ──────────────────────────────────────────────────────────

    private ClpSimulationDto toDto(ClpSimulation s, KpiDto currentKpi) {
        ClpSimulationDto dto = new ClpSimulationDto();
        dto.setId(s.getId());
        dto.setScenarioType(s.getScenarioType().name());
        dto.setStartDate(s.getStartDate());
        dto.setStatus(s.getStatus().name());
        dto.setAlgorithm(s.getAlgorithm());
        dto.setCancellationRate(s.getCancellationRate().doubleValue());
        dto.setSeed(s.getSeed());
        dto.setVolumePerDay(s.getVolumePerDay());
        dto.setSimulatedTime(s.getSimulatedTime());
        dto.setDaysSimulated(s.getDaysSimulated());
        dto.setCollapsedAt(s.getCollapsedAt());
        dto.setCollapsedAirportIata(
                s.getCollapsedAirport() != null ? s.getCollapsedAirport().getIataCode() : null);
        dto.setCreatedAt(s.getCreatedAt());
        dto.setCurrentKpi(currentKpi);
        return dto;
    }
}
