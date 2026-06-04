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
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.BaggageBatchRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;
import pe.pucp.tasfb2b.repository.SimulationRepository;
import pe.pucp.tasfb2b.service.PlannerService;
import pe.pucp.tasfb2b.websocket.WebSocketEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@RequiredArgsConstructor
@Slf4j
public class BlockOrchestrator {

    @Value("${tasf.simulation.tick-interval-ms:1000}")
    private long tickIntervalMs;

    @Value("${tasf.simulation.max-batches-per-block:999}")
    private int maxBatchesPerBlock;

    private final SimulationRepository simulationRepo;
    private final BaggageBatchRepository batchRepo;
    private final FlightRepository flightRepo;
    private final AirportRepository airportRepo;
    private final PlannerService plannerService;
    private final SimulationEngine simulationEngine;
    private final WebSocketEventPublisher webSocketPublisher;

    private final ConcurrentHashMap<Long, OrchestratorState> states = new ConcurrentHashMap<>();

    // Global counter for unique planner thread names
    private static final AtomicInteger plannerThreadCounter = new AtomicInteger(0);

    public void start(Long simId) {
        OrchestratorState state = new OrchestratorState(simId);
        states.put(simId, state);
        Thread thread = new Thread(() -> runPipeline(simId), "orchestrator-" + simId);
        state.thread = thread;
        thread.start();
    }

    public void pause(Long simId) {
        log.info("ACTION: pause() invocado para simId={}", simId);
        OrchestratorState state = states.get(simId);
        if (state != null) {
            state.paused = true;
            log.info("Simulación {}: ha sido PAUSADA internamente", simId);
        } else {
            log.warn("Simulación {}: intento de pausa, pero estado no encontrado", simId);
        }
    }

    public void resume(Long simId) {
        log.info("ACTION: resume() invocado para simId={}", simId);
        OrchestratorState state = states.get(simId);
        if (state != null) {
            synchronized (state) {
                state.paused = false;
                state.notifyAll();
                log.info("Simulación {}: ha sido REANUDADA internamente", simId);
            }
        } else {
            log.warn("Simulación {}: intento de reanudar, pero estado no encontrado", simId);
        }
    }

    public void stop(Long simId) {
        OrchestratorState state = states.remove(simId);
        if (state != null) {
            state.stopped = true;
            synchronized (state) {
                state.notifyAll();
            }
            // Cancel any in-flight background planning
            if (state.nextBlockFuture != null) {
                state.nextBlockFuture.cancel(true);
            }
            state.plannerExecutor.shutdownNow();
            if (state.thread != null) {
                state.thread.interrupt();
            }
        }
    }

    // ─── Pipeline ────────────────────────────────────────────────────────────────

    @Value("${tasf.simulation.block-size-hours:2}")
    private int blockSizeHours;

    @Value("${tasf.simulation.flight-lookahead-hours:48}")
    private int flightLookaheadHours;

    private void runPipeline(Long simId) {
        try {
            Simulation sim = simulationRepo.findById(simId).orElseThrow();
            int totalDays = sim.getPeriodDays() != null ? sim.getPeriodDays() : 5;
            LocalDateTime simStart = sim.getStartDate().atStartOfDay();
            LocalDateTime simEnd = simStart.plusDays(totalDays);
            int totalBlocks = totalDays * (24 / blockSizeHours);

            long pipelineWall = System.currentTimeMillis();
            for (int block = 0; block < totalBlocks; block++) {
                OrchestratorState state = states.get(simId);
                if (state == null || state.stopped) break;

                LocalDateTime blockStart = simStart.plusHours((long) block * blockSizeHours);
                LocalDateTime blockEnd = blockStart.plusHours(blockSizeHours);

                long blockWall = System.currentTimeMillis();
                SimulationBlock simBlock;

                if (block == 0) {
                    // First block must be planned synchronously — nothing to play yet.
                    log.info("Simulación {}: BUFFERING bloque 0 de {}", simId, totalBlocks);
                    setStatus(simId, SimulationStatus.BUFFERING);
                    webSocketPublisher.publishBlockStart(simId, 0, totalBlocks);
                    simBlock = planBlock(simId, sim, blockStart, blockEnd, 0, simEnd);
                } else {
                    // Subsequent blocks were planned in background during the previous playback.
                    // Resolve the future — should already be done; log a warning if we had to wait.
                    simBlock = resolveNextBlock(state, block, blockStart, blockEnd);
                }

                state = states.get(simId);
                if (state == null || state.stopped) break;

                log.info("Simulación {}: PLAYING bloque {} ({} lotes planificados)", simId, block, simBlock.batchesPlanned());
                setStatus(simId, SimulationStatus.PLAYING);

                // Submit planning of the NEXT block in background BEFORE starting playback of current block.
                // This way ALNS and visualization run in parallel — no freeze between blocks.
                if (block + 1 < totalBlocks) {
                    submitBackgroundPlanning(simId, sim, block + 1, totalBlocks, simEnd, state);
                }

                playBlock(simId, simBlock, state);

                log.info("[ORCH-{}] block {} total wallMs={} (since pipeline start: {}ms)",
                        simId, block, System.currentTimeMillis() - blockWall,
                        System.currentTimeMillis() - pipelineWall);
            }

            OrchestratorState state = states.remove(simId);
            if (state != null && !state.stopped) {
                state.plannerExecutor.shutdown();
                setStatus(simId, SimulationStatus.FINISHED);
                simulationEngine.removeState(simId);
                webSocketPublisher.publishFinished(simId);
                log.info("Simulación {} completada (pipeline finalizado)", simId);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.info("Orchestrator de simulación {} interrumpido", simId);
        } catch (Exception e) {
            log.error("Error fatal en pipeline de simulación {}", simId, e);
            setStatus(simId, SimulationStatus.FINISHED);
            OrchestratorState s = states.remove(simId);
            if (s != null) s.plannerExecutor.shutdownNow();
        }
    }

    /**
     * Submits planning of {@code nextDay} to the per-simulation background executor.
     * The result is stored in {@code state.nextBlockFuture} and retrieved by
     * {@link #resolveNextBlock} at the start of the next iteration.
     * <p>
     * We deliberately do NOT emit BLOCK_START here: that event triggers the
     * planning overlay on the frontend, which would freeze the visualization.
     * ALNS will still push OPTIMIZING events that update the progress bar without
     * changing the main simulation status.
     */
    private void submitBackgroundPlanning(Long simId, Simulation sim, int nextBlock, int totalBlocks,
                                          LocalDateTime simEnd, OrchestratorState state) {
        LocalDateTime nextStart = sim.getStartDate().atStartOfDay().plusHours((long) nextBlock * blockSizeHours);
        LocalDateTime nextEnd   = nextStart.plusHours(blockSizeHours);

        log.info("Simulación {}: lanzando planificación en segundo plano del bloque {} de {}",
                simId, nextBlock, totalBlocks);

        state.nextBlockFuture = state.plannerExecutor.submit(
                () -> planBlock(simId, sim, nextStart, nextEnd, nextBlock, simEnd)
        );
    }

    /**
     * Waits for the background-planned block future.
     * If planning finished before playback ended (the happy path), this returns immediately.
     * If it's still running, we block and log a warning — that gap will be visible in the UI.
     */
    private SimulationBlock resolveNextBlock(OrchestratorState state, int day,
                                             LocalDateTime blockStart, LocalDateTime blockEnd) {
        if (state.nextBlockFuture == null) {
            log.warn("Simulación: no había future para bloque {} — se devuelve bloque vacío", day);
            return new SimulationBlock(day, blockStart, blockEnd, 0);
        }
        try {
            long waitStart = System.currentTimeMillis();
            SimulationBlock result = state.nextBlockFuture.get();
            long waited = System.currentTimeMillis() - waitStart;
            if (waited > 200) {
                log.warn("Bloque {} no estaba listo al iniciar playback: esperó {} ms extra (gap visible en visualización). "
                        + "Considera reducir max-iterations o ampliar el tick-interval.", day, waited);
            } else {
                log.info("Bloque {} listo sin espera (planificación paralela exitosa)", day);
            }
            state.nextBlockFuture = null;
            return result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new SimulationBlock(day, blockStart, blockEnd, 0);
        } catch (ExecutionException e) {
            log.error("Error en planificación paralela del bloque {}: {}", day,
                    e.getCause() != null ? e.getCause().getMessage() : e.getMessage());
            return new SimulationBlock(day, blockStart, blockEnd, 0);
        }
    }

    // ─── Planning & Playback ─────────────────────────────────────────────────────

    private SimulationBlock planBlock(Long simId, Simulation sim, LocalDateTime blockStart,
                                      LocalDateTime blockEnd, int blockIndex, LocalDateTime simEnd) {
        try {
            // Only plan batches not yet routed that become available within this block.
            // Using findUnroutedBatches prevents re-planning batches already assigned in prior blocks
            // (their BaggageBatch.status stays IN_ORIGIN until the flight departs).
            List<BaggageBatch> pending = batchRepo.findUnroutedBatches(blockEnd);
            if (pending.isEmpty()) {
                log.info("Simulación {}: sin lotes sin ruta en bloque {}", simId, blockIndex);
                return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
            }
            if (pending.size() > maxBatchesPerBlock) {
                log.info("Simulación {}: limitando bloque {} a {} de {} lotes pendientes",
                        simId, blockIndex, maxBatchesPerBlock, pending.size());
                pending = pending.subList(0, maxBatchesPerBlock);
            }

            // Lookahead window: enough for multi-hop routes extending beyond this block.
            LocalDateTime flightLookahead = blockStart.plusHours(flightLookaheadHours)
                    .isAfter(simEnd) ? simEnd : blockStart.plusHours(flightLookaheadHours);
            List<Flight> flights = flightRepo.findScheduledBetween(blockStart, flightLookahead);
            List<Airport> airports = airportRepo.findAll();

            SimulationContext context = SimulationContext.builder()
                    .airports(airports)
                    .flights(flights)
                    .pendingBatches(pending)
                    .simulatedNow(blockStart)
                    .alnsParams(plannerService.buildAlnsParams(sim))
                    .progressCallback(snap -> webSocketPublisher.publishPlanProgress(simId, snap))
                    .build();

            log.info("Simulación {}: planificando {} lotes para bloque {}", simId, pending.size(), blockIndex);
            long startPlanTime = System.currentTimeMillis();
            plannerService.plan(context, sim.getAlgorithm());
            long endPlanTime = System.currentTimeMillis();
            log.info("Simulación {}: planificación de bloque {} finalizada en {} ms", simId, blockIndex,
                    endPlanTime - startPlanTime);

            return new SimulationBlock(blockIndex, blockStart, blockEnd, pending.size());

        } catch (Exception e) {
            log.error("Error planificando bloque {} de simulación {}: {}", blockIndex, simId, e.getMessage(), e);
            return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
        }
    }

    private void playBlock(Long simId, SimulationBlock block, OrchestratorState state)
            throws InterruptedException {
        LocalDateTime blockEnd = block.end();
        long playWallStart = System.currentTimeMillis();
        int ticksInBlock = 0;

        log.info("[ORCH-{}] block {} playback start | simWindow={} → {}",
                simId, block.blockIndex(), block.start(), blockEnd);

        while (true) {
            if (state.stopped) break;

            waitIfPaused(state);
            if (state.stopped) break;

            LocalDateTime simNow = simulationEngine.tick(simId);
            if (simNow == null) break;
            ticksInBlock++;

            boolean blockDone = !simNow.isBefore(blockEnd);
            Thread.sleep(tickIntervalMs);
            if (blockDone) break;
        }

        long playDurationMs = System.currentTimeMillis() - playWallStart;
        log.info("[ORCH-{}] block {} playback done | ticks={} wallMs={} avgMs/tick={}",
                simId, block.blockIndex(), ticksInBlock, playDurationMs,
                ticksInBlock > 0 ? playDurationMs / ticksInBlock : 0);
    }

    private void waitIfPaused(OrchestratorState state) throws InterruptedException {
        if (!state.paused) return;
        synchronized (state) {
            while (state.paused && !state.stopped) {
                state.wait(500);
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    @Transactional
    protected void setStatus(Long simId, SimulationStatus status) {
        simulationRepo.findById(simId).ifPresent(s -> {
            s.setStatus(status);
            simulationRepo.save(s);
        });
    }

    // ─── State ────────────────────────────────────────────────────────────────────

    static class OrchestratorState {
        volatile boolean paused = false;
        volatile boolean stopped = false;
        Thread thread;
        final ExecutorService plannerExecutor;
        volatile Future<SimulationBlock> nextBlockFuture;

        OrchestratorState(Long simId) {
            int seq = plannerThreadCounter.incrementAndGet();
            this.plannerExecutor = Executors.newSingleThreadExecutor(
                    r -> new Thread(r, "planner-bg-" + simId + "-" + seq)
            );
        }
    }
}
