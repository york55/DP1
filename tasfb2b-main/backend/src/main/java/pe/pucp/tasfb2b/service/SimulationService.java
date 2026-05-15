package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.dto.request.CreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.dto.response.SimulationDto;
import pe.pucp.tasfb2b.exception.SimulationNotFoundException;
import pe.pucp.tasfb2b.mapper.SimulationMapper;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.simulation.BlockOrchestrator;
import pe.pucp.tasfb2b.simulation.SimulationEngine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationService {

    private final SimulationRepository simulationRepo;
    private final FlightRepository flightRepo;
    private final FlightCancellationRepository cancellationRepo;
    private final SimulationEngine simulationEngine;
    private final BlockOrchestrator blockOrchestrator;
    private final KpiService kpiService;
    private final SimulationMapper simulationMapper;

    @Transactional
    public SimulationDto createSimulation(CreateSimulationRequest req) {
        Simulation sim = new Simulation();
        sim.setScenarioType(ScenarioType.valueOf(req.getScenarioType()));
        sim.setPeriodDays(req.getPeriodDays());
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

        Simulation saved = simulationRepo.save(sim);
        log.info("Simulación creada: id={}, tipo={}, período={}días, algoritmo={}",
                saved.getId(), saved.getScenarioType(), saved.getPeriodDays(), saved.getAlgorithm());

        return simulationMapper.toDto(saved, null);
    }

    public SimulationDto getSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));
        KpiDto kpi = kpiService.getLatest(id);
        return simulationMapper.toDto(sim, kpi);
    }

    @Transactional
    public SimulationDto startSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        if (sim.getStatus() != SimulationStatus.CONFIGURED) {
            throw new IllegalArgumentException("La simulación no puede iniciarse en estado: " + sim.getStatus());
        }

        resetFlightsForSimulation(sim);
        sim.setStatus(SimulationStatus.BUFFERING);
        simulationRepo.save(sim);
        simulationEngine.initSimulation(id);

        // Launch the block pipeline after this transaction commits
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.start(id);
            }
        });

        log.info("Simulación {} iniciada — pipeline de bloques arrancando", id);
        return simulationMapper.toDto(sim, null);
    }

    @Transactional
    public SimulationDto pauseSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        blockOrchestrator.pause(id);
        sim.setStatus(SimulationStatus.PAUSED);
        simulationRepo.save(sim);

        log.info("Simulación {} pausada", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationDto resumeSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        if (sim.getStatus() != SimulationStatus.PAUSED) {
            throw new IllegalArgumentException("Solo se puede reanudar una simulación pausada");
        }

        sim.setStatus(SimulationStatus.PLAYING);
        simulationRepo.save(sim);

        // Resume orchestrator only after DB commit so tick() sees PLAYING
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.resume(id);
            }
        });

        log.info("Simulación {} reanudada", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationDto stopSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        blockOrchestrator.stop(id);
        simulationEngine.removeState(id);
        sim.setStatus(SimulationStatus.FINISHED);
        simulationRepo.save(sim);

        log.info("Simulación {} detenida", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    public List<SimulationDto> findAll() {
        return simulationRepo.findAll().stream()
                .map(s -> simulationMapper.toDto(s, null))
                .toList();
    }

    private void resetFlightsForSimulation(Simulation sim) {
        LocalDateTime start = sim.getStartDate().atStartOfDay();
        LocalDateTime end = start.plusDays(sim.getPeriodDays() != null ? sim.getPeriodDays() : 5);
        List<Flight> flights = flightRepo.findAllBetween(start, end);
        List<Long> flightIds = flights.stream().map(Flight::getId).toList();
        if (!flightIds.isEmpty()) {
            cancellationRepo.deleteByFlightIdIn(flightIds);
        }
        for (Flight f : flights) {
            f.setStatus(FlightStatus.SCHEDULED);
            f.setCurrentLoad(0);
        }
        flightRepo.saveAll(flights);
        log.info("Reset {} vuelos para simulación {}", flights.size(), sim.getId());
    }
}
