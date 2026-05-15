package pe.pucp.tasfb2b.simulation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Simulation;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.BaggageBatchRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;
import pe.pucp.tasfb2b.repository.SimulationRepository;
import pe.pucp.tasfb2b.service.PlannerService;
import pe.pucp.tasfb2b.websocket.WebSocketEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class BlockOrchestrator {

    @Value("${tasf.simulation.tick-interval-ms:1000}")
    private long tickIntervalMs;

    private final SimulationRepository simulationRepo;
    private final BaggageBatchRepository batchRepo;
    private final FlightRepository flightRepo;
    private final AirportRepository airportRepo;
    private final PlannerService plannerService;
    private final SimulationEngine simulationEngine;
    private final WebSocketEventPublisher webSocketPublisher;

    private final ConcurrentHashMap<Long, OrchestratorState> states = new ConcurrentHashMap<>();

    public void start(Long simId) {
        OrchestratorState state = new OrchestratorState();
        states.put(simId, state);
        Thread thread = Thread.ofVirtual()
                .name("orchestrator-" + simId)
                .start(() -> runPipeline(simId));
        state.thread = thread;
    }

    public void pause(Long simId) {
        OrchestratorState state = states.get(simId);
        if (state != null) {
            state.paused = true;
        }
    }

    public void resume(Long simId) {
        OrchestratorState state = states.get(simId);
        if (state != null) {
            synchronized (state) {
                state.paused = false;
                state.notifyAll();
            }
        }
    }

    public void stop(Long simId) {
        OrchestratorState state = states.remove(simId);
        if (state != null) {
            state.stopped = true;
            synchronized (state) {
                state.notifyAll();
            }
            if (state.thread != null) {
                state.thread.interrupt();
            }
        }
    }

    private void runPipeline(Long simId) {
        try {
            Simulation sim = simulationRepo.findById(simId).orElseThrow();
            int totalDays = sim.getPeriodDays() != null ? sim.getPeriodDays() : 5;
            LocalDateTime simEnd = sim.getStartDate().atStartOfDay().plusDays(totalDays);

            for (int day = 0; day < totalDays; day++) {
                OrchestratorState state = states.get(simId);
                if (state == null || state.stopped) break;

                LocalDateTime blockStart = sim.getStartDate().atStartOfDay().plusDays(day);
                LocalDateTime blockEnd = blockStart.plusDays(1);

                // BUFFERING: plan this block
                log.info("Simulación {}: BUFFERING bloque {} (día {} de {})", simId, day, day + 1, totalDays);
                setStatus(simId, SimulationStatus.BUFFERING);
                webSocketPublisher.publishBlockStart(simId, day, totalDays);

                SimulationBlock block = planBlock(simId, sim, blockStart, blockEnd, day, simEnd);

                state = states.get(simId);
                if (state == null || state.stopped) break;

                // PLAYING: tick through this block
                log.info("Simulación {}: PLAYING bloque {} ({} lotes planificados)", simId, day, block.batchesPlanned());
                setStatus(simId, SimulationStatus.PLAYING);

                playBlock(simId, block, state);
            }

            OrchestratorState state = states.remove(simId);
            if (state != null && !state.stopped) {
                setStatus(simId, SimulationStatus.FINISHED);
                simulationEngine.removeState(simId);
                log.info("Simulación {} completada (pipeline finalizado)", simId);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.info("Orchestrator de simulación {} interrumpido", simId);
        } catch (Exception e) {
            log.error("Error fatal en pipeline de simulación {}", simId, e);
            setStatus(simId, SimulationStatus.FINISHED);
            states.remove(simId);
        }
    }

    private SimulationBlock planBlock(Long simId, Simulation sim, LocalDateTime blockStart,
                                       LocalDateTime blockEnd, int blockIndex, LocalDateTime simEnd) {
        try {
            List<BaggageBatch> pending = batchRepo.findPendingBatches(blockEnd);
            if (pending.isEmpty()) {
                log.info("Simulación {}: sin lotes pendientes en bloque {}", simId, blockIndex);
                return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
            }

            List<Flight> flights = flightRepo.findScheduledBetween(blockStart, simEnd);
            List<Airport> airports = airportRepo.findAll();
            AlnsParams alnsParams = buildAlnsParams(sim);

            SimulationContext context = SimulationContext.builder()
                    .airports(airports)
                    .flights(flights)
                    .pendingBatches(pending)
                    .simulatedNow(blockStart)
                    .alnsParams(alnsParams)
                    .progressCallback(snap -> webSocketPublisher.publishPlanProgress(simId, snap))
                    .build();

            log.info("Simulación {}: planificando {} lotes para bloque {}", simId, pending.size(), blockIndex);
            plannerService.plan(context, sim.getAlgorithm());

            return new SimulationBlock(blockIndex, blockStart, blockEnd, pending.size());

        } catch (Exception e) {
            log.error("Error planificando bloque {} de simulación {}: {}", blockIndex, simId, e.getMessage(), e);
            return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
        }
    }

    private void playBlock(Long simId, SimulationBlock block, OrchestratorState state)
            throws InterruptedException {
        LocalDateTime blockEnd = block.end();

        while (true) {
            if (state.stopped) break;

            waitIfPaused(state);
            if (state.stopped) break;

            LocalDateTime simNow = simulationEngine.tick(simId);
            if (simNow == null) break;

            if (!simNow.isBefore(blockEnd)) break;

            Thread.sleep(tickIntervalMs);
        }
    }

    private void waitIfPaused(OrchestratorState state) throws InterruptedException {
        if (!state.paused) return;
        synchronized (state) {
            while (state.paused && !state.stopped) {
                state.wait(500);
            }
        }
    }

    @Transactional
    protected void setStatus(Long simId, SimulationStatus status) {
        simulationRepo.findById(simId).ifPresent(s -> {
            s.setStatus(status);
            simulationRepo.save(s);
        });
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

    static class OrchestratorState {
        volatile boolean paused = false;
        volatile boolean stopped = false;
        Thread thread;
    }
}
