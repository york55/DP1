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
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.simulation.SimulationEngine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationService {

    @Value("${tasf.simulation.tick-interval-ms:1000}")
    private long tickIntervalMs;

    private final SimulationRepository simulationRepo;
    private final FlightRepository flightRepo;
    private final BaggageBatchRepository batchRepo;
    private final AirportRepository airportRepo;
    private final FlightCancellationRepository cancellationRepo;
    private final SimulationEngine simulationEngine;
    private final PlannerService plannerService;
    private final KpiService kpiService;
    private final SimulationMapper simulationMapper;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);
    private final ConcurrentHashMap<Long, ScheduledFuture<?>> runningSimulations = new ConcurrentHashMap<>();

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

        if (sim.getStatus() != SimulationStatus.CONFIGURED && sim.getStatus() != SimulationStatus.PAUSED) {
            throw new IllegalArgumentException("La simulación no puede iniciarse en estado: " + sim.getStatus());
        }

        final boolean needsPlanning = sim.getStatus() == SimulationStatus.CONFIGURED;
        if (needsPlanning) {
            resetFlightsForSimulation(sim);
        }

        sim.setStatus(SimulationStatus.RUNNING);
        simulationRepo.save(sim);
        simulationEngine.initSimulation(id);

        // Run initial planning in background after this transaction commits to avoid HTTP timeout
        if (needsPlanning) {
            final Simulation simSnapshot = sim;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    scheduler.submit(() -> {
                        try {
                            runInitialPlanning(simSnapshot);
                        } catch (Exception e) {
                            log.error("Error en planificación inicial async para simulación {}: {}", id, e.getMessage(), e);
                        }
                        scheduleSimulation(id);
                    });
                }
            });
        } else {
            scheduleSimulation(id);
        }

        log.info("Simulación {} iniciada (planificación en background)", id);
        return simulationMapper.toDto(sim, null);
    }

    @Transactional
    public SimulationDto pauseSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        cancelSchedule(id);
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

        sim.setStatus(SimulationStatus.RUNNING);
        simulationRepo.save(sim);

        scheduleSimulation(id);

        log.info("Simulación {} reanudada", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationDto stopSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        cancelSchedule(id);
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

    private void scheduleSimulation(Long simulationId) {
        cancelSchedule(simulationId);
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(
                () -> simulationEngine.tick(simulationId),
                0, tickIntervalMs, TimeUnit.MILLISECONDS
        );
        runningSimulations.put(simulationId, future);
    }

    private void cancelSchedule(Long simulationId) {
        ScheduledFuture<?> future = runningSimulations.remove(simulationId);
        if (future != null) {
            future.cancel(false);
        }
    }

    private void resetFlightsForSimulation(Simulation sim) {
        LocalDateTime start = sim.getStartDate().atStartOfDay();
        LocalDateTime end = start.plusDays(sim.getPeriodDays() != null ? sim.getPeriodDays() : 7);
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

    private void runInitialPlanning(Simulation sim) {
        try {
            long startTime = System.currentTimeMillis();
            LocalDateTime simNow = sim.getStartDate().atStartOfDay();
            List<BaggageBatch> pending = batchRepo.findPendingBatches(simNow.plusDays(
                    sim.getPeriodDays() != null ? sim.getPeriodDays() : 7));
            List<Flight> flights = flightRepo.findAllWithAirports();
            List<Airport> airports = airportRepo.findAll();

            if (pending.isEmpty()) {
                log.info("No hay lotes pendientes para planificar en simulación {}", sim.getId());
                return;
            }

            log.info("Simulación {}: Iniciando planificación inicial de {} lotes...", sim.getId(), pending.size());
            
            AlnsParams alnsParams = buildAlnsParams(sim);
            SimulationContext context = SimulationContext.builder()
                    .airports(airports)
                    .flights(flights)
                    .pendingBatches(pending)
                    .simulatedNow(simNow)
                    .alnsParams(alnsParams)
                    .build();

            long planStart = System.currentTimeMillis();
            plannerService.plan(context, sim.getAlgorithm());
            long planEnd = System.currentTimeMillis();
            
            long totalTime = planEnd - startTime;
            log.info("Planificación inicial completada para simulación {}: {} lotes en {}ms (Planificación: {}ms)",
                    sim.getId(), pending.size(), totalTime, (planEnd - planStart));

        } catch (Exception e) {
            log.error("Error en planificación inicial de simulación {}: {}",
                    sim.getId(), e.getMessage(), e);
        }
    }

    private AlnsParams buildAlnsParams(Simulation sim) {
        AlnsParams defaults = AlnsParams.defaults();
        return new AlnsParams(
                sim.getT0() != null ? sim.getT0() : defaults.t0(),
                sim.getAlphaSa() != null ? sim.getAlphaSa() : defaults.alpha(),
                sim.getQPct() != null ? sim.getQPct() : defaults.qPct(),
                sim.getMaxIterations() != null ? sim.getMaxIterations() : defaults.maxIterations(),
                defaults.segLen(), defaults.sigma1(), defaults.sigma2(), defaults.sigma3(),
                defaults.rho(), defaults.pNoise(), defaults.w1(), defaults.w2(), defaults.w3(),
                defaults.kRegret()
        );
    }
}
