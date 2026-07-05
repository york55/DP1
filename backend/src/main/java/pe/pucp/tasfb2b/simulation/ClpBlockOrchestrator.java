package pe.pucp.tasfb2b.simulation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.planner.PlanProgressSnapshot;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.service.ClpEnvioLoader;
import pe.pucp.tasfb2b.service.ClpPlannerService;
import pe.pucp.tasfb2b.websocket.WebSocketEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Orchestrator for the Collapse simulation.
 *
 * Same pipeline structure as BlockOrchestrator but:
 *  - No fixed total days: runs until an airport > 100% occupancy.
 *  - Periodic reading: every 4 simulated days, read 5 more days of envíos
 *    (with 1 day buffer overlap). First batch reads 5 days from startDate.
 *  - Flights are expanded infinitely in rolling windows.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClpBlockOrchestrator {

    /** How many days to read from EnvioStore at a time */
    private static final int READ_WINDOW_DAYS = 5;
    /** After how many simulated days do we read the next batch (leaves 1-day buffer) */
    private static final int SIMULATE_BEFORE_NEXT_READ = 4;

    @Value("${tasf.simulation.tick-interval-ms:1000}")
    private long tickIntervalMs;

    // Bloque propio del escenario de colapso: la ventana de vuelos/lotes que lee
    // (ver ClpEnvioLoader) es mucho más grande que la del escenario de 5 días,
    // así que el ALNS tarda bastante más por bloque (~20-25s en la práctica).
    // Si block-size-hours es muy chico, el playback de un bloque (pocos ticks)
    // termina mucho antes que la planificación del siguiente, y el orquestador
    // pasa la mayor parte del tiempo bloqueado en resolveNextBlock() sin emitir
    // ticks por WebSocket. Por eso usa su propia key, separada de la del
    // escenario de 5 días, con un default más grande.
    @Value("${tasf.simulation.clp.block-size-hours:6}")
    private int blockSizeHours;

    /** Cada cuánto (ms) mandamos un tick "keep-alive" mientras esperamos que
     *  termine la planificación en background del siguiente bloque. Evita que
     *  el topic /tick quede en silencio por 20+ segundos seguidos. */
    @Value("${tasf.simulation.clp.keepalive-interval-ms:3000}")
    private long keepAliveIntervalMs;

    @Value("${tasf.simulation.flight-lookahead-hours:16}")
    private int flightLookaheadHours;

    @Value("${tasf.simulation.max-batches-per-block:200}")
    private int maxBatchesPerBlock;

    private final ClpSimulationRepository simulationRepo;
    private final ClpBaggageBatchRepository batchRepo;
    private final ClpFlightRepository flightRepo;
    private final ClpAirportRepository airportRepo;
    private final ClpPlannerService plannerService;
    private final ClpSimulationEngine simulationEngine;
    private final ClpEnvioLoader envioLoader;
    private final WebSocketEventPublisher webSocketPublisher;

    private final ConcurrentHashMap<Long, ClpOrchestratorState> states = new ConcurrentHashMap<>();
    private static final AtomicInteger plannerThreadCounter = new AtomicInteger(0);

    public void start(Long simId) {
        ClpOrchestratorState state = new ClpOrchestratorState(simId);
        states.put(simId, state);
        Thread thread = new Thread(() -> runPipeline(simId), "clp-orchestrator-" + simId);
        state.thread = thread;
        thread.start();
    }

    public void pause(Long simId) {
        ClpOrchestratorState state = states.get(simId);
        if (state != null) { state.paused = true; }
    }

    public void resume(Long simId) {
        ClpOrchestratorState state = states.get(simId);
        if (state != null) {
            synchronized (state) { state.paused = false; state.notifyAll(); }
        }
    }

    public void stop(Long simId) {
        ClpOrchestratorState state = states.remove(simId);
        if (state != null) {
            state.stopped = true;
            synchronized (state) { state.notifyAll(); }
            if (state.nextBlockFuture != null) state.nextBlockFuture.cancel(true);
            state.plannerExecutor.shutdownNow();
            if (state.thread != null) state.thread.interrupt();
        }
    }

    // ─── Pipeline ────────────────────────────────────────────────────────────

    private void runPipeline(Long simId) {
        try {
            ClpSimulation sim = simulationRepo.findById(simId).orElseThrow();
            LocalDateTime simStart = sim.getStartDate();

            // Initial read: 5 days from start
            LocalDateTime readUntil = simStart.plusDays(READ_WINDOW_DAYS);
            log.info("[CLP-{}] Lectura inicial de envíos: {} → {}", simId, simStart, readUntil);
            envioLoader.loadFromFiles(simStart, readUntil);
            updateLastReadUntil(simId, readUntil);

            // Also expand flights for the initial window
            expandFlightsIfNeeded(sim, readUntil);

            int daysSimulatedSinceLastRead = 0;
            int blockIndex = 0;

            while (true) {
                ClpOrchestratorState state = states.get(simId);
                if (state == null || state.stopped) break;

                LocalDateTime blockStart = simStart.plusHours((long) blockIndex * blockSizeHours);
                LocalDateTime blockEnd = blockStart.plusHours(blockSizeHours);

                // ── Periodic reading: every 4 simulated days, read 5 more ──
                int currentSimDay = (int) (java.time.Duration.between(simStart, blockStart).toDays());
                if (currentSimDay >= daysSimulatedSinceLastRead + SIMULATE_BEFORE_NEXT_READ) {
                    LocalDateTime newReadFrom = readUntil;
                    readUntil = readUntil.plusDays(READ_WINDOW_DAYS);
                    log.info("[CLP-{}] Lectura periódica de envíos: {} → {}", simId, newReadFrom, readUntil);
                    envioLoader.loadFromFiles(newReadFrom, readUntil);
                    updateLastReadUntil(simId, readUntil);

                    // Expand flights for the new window
                    expandFlightsIfNeeded(sim, readUntil);

                    daysSimulatedSinceLastRead = currentSimDay;
                }

                // ── Plan & play block ──
                SimulationBlock simBlock;
                if (blockIndex == 0) {
                    setStatus(simId, SimulationStatus.BUFFERING);
                    webSocketPublisher.publishBlockStart(simId, 0, -1, blockStart, blockEnd);
                    simBlock = planBlock(simId, sim, blockStart, blockEnd, blockIndex, readUntil);
                } else {
                    simBlock = resolveNextBlock(simId, state, blockIndex, blockStart, blockEnd);
                }

                state = states.get(simId);
                if (state == null || state.stopped) break;

                setStatus(simId, SimulationStatus.PLAYING);

                // Pre-plan next block in background
                submitBackgroundPlanning(simId, sim, blockIndex + 1, readUntil, state);

                // Play the block — check for collapse on each tick
                boolean collapsed = playBlock(simId, simBlock, state);

                if (collapsed) {
                    log.info("[CLP-{}] ¡COLAPSO! Simulación terminada en bloque {}", simId, blockIndex);
                    break;
                }

                // Update days_simulated
                int newDay = (int) (java.time.Duration.between(simStart, blockEnd).toDays());
                updateDaysSimulated(simId, newDay);

                blockIndex++;
            }

            ClpOrchestratorState state = states.remove(simId);
            if (state != null && !state.stopped) {
                state.plannerExecutor.shutdown();
                setStatus(simId, SimulationStatus.FINISHED);
                simulationEngine.removeState(simId);
                webSocketPublisher.publishFinished(simId);
                log.info("[CLP-{}] Simulación de colapso completada", simId);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.info("[CLP] Orchestrator interrumpido para simulación {}", simId);
        } catch (Exception e) {
            log.error("[CLP] Error fatal en pipeline de simulación {}", simId, e);
            setStatus(simId, SimulationStatus.FINISHED);
            ClpOrchestratorState s = states.remove(simId);
            if (s != null) s.plannerExecutor.shutdownNow();
        }
    }

    // ── Flight expansion ────────────────────────────────────────────────────

    private static final java.time.LocalDate FLIGHT_TEMPLATE_DATE = java.time.LocalDate.of(2026, 5, 10);

    /**
     * Expands DAILY flight templates for collapse simulation up to the given date.
     * Only creates instances that don't exist yet (beyond what was already expanded).
     */
    private void expandFlightsIfNeeded(ClpSimulation sim, LocalDateTime expandUntil) {
        List<ClpFlight> templates = flightRepo.findByFrequency("DAILY");
        if (templates.isEmpty()) return;

        java.time.LocalDate simStartDate = sim.getStartDate().toLocalDate();
        java.time.LocalDate expandDate = expandUntil.toLocalDate();
        long totalDaysNeeded = java.time.temporal.ChronoUnit.DAYS.between(simStartDate, expandDate);

        // Find max existing instance date to avoid duplicates
        List<ClpFlight> instances = flightRepo.findByFrequency("INSTANCE");
        java.time.LocalDate maxExistingDate = instances.stream()
                .map(f -> f.getDepartureTime().toLocalDate())
                .max(java.time.LocalDate::compareTo)
                .orElse(simStartDate.minusDays(1));

        long baseOffset = java.time.temporal.ChronoUnit.DAYS.between(FLIGHT_TEMPLATE_DATE, simStartDate);

        java.util.List<ClpFlight> newInstances = new java.util.ArrayList<>();
        for (int day = 0; day <= totalDaysNeeded; day++) {
            java.time.LocalDate targetDate = simStartDate.plusDays(day);
            if (!targetDate.isAfter(maxExistingDate)) continue;
            if (day == 0 && baseOffset == 0) continue;

            long totalOffset = baseOffset + day;
            for (ClpFlight tmpl : templates) {
                ClpFlight inst = new ClpFlight();
                inst.setOriginAirport(tmpl.getOriginAirport());
                inst.setDestinationAirport(tmpl.getDestinationAirport());
                inst.setDepartureTime(tmpl.getDepartureTime().plusDays(totalOffset));
                inst.setArrivalTime(tmpl.getArrivalTime().plusDays(totalOffset));
                inst.setBaggageCapacity(tmpl.getBaggageCapacity());
                inst.setFrequency("INSTANCE");
                inst.setStatus(FlightStatus.SCHEDULED);
                inst.setAirline(tmpl.getAirline());
                newInstances.add(inst);
            }
        }
        if (!newInstances.isEmpty()) {
            flightRepo.saveAll(newInstances);
            log.info("[CLP] Expandidos {} vuelos instancia hasta {}", newInstances.size(), expandDate);
        }
    }

    // ─── Planning & Playback ─────────────────────────────────────────────────

    private void submitBackgroundPlanning(Long simId, ClpSimulation sim, int nextBlock,
                                          LocalDateTime simEnd, ClpOrchestratorState state) {
        LocalDateTime nextStart = sim.getStartDate().plusHours((long) nextBlock * blockSizeHours);
        LocalDateTime nextEnd = nextStart.plusHours(blockSizeHours);

        state.nextBlockFuture = state.plannerExecutor.submit(
                () -> planBlock(simId, sim, nextStart, nextEnd, nextBlock, simEnd));
    }

    private SimulationBlock resolveNextBlock(Long simId, ClpOrchestratorState state, int block,
                                              LocalDateTime blockStart, LocalDateTime blockEnd)
            throws InterruptedException {
        if (state.nextBlockFuture == null) {
            return new SimulationBlock(block, blockStart, blockEnd, 0);
        }
        // En vez de bloquearnos en un solo future.get() (lo que puede dejar el
        // topic /tick mudo por 20+ segundos si el ALNS tarda), hacemos polling
        // con timeout y mandamos un tick keep-alive entre medio.
        while (true) {
            if (state.stopped) return new SimulationBlock(block, blockStart, blockEnd, 0);
            try {
                SimulationBlock result = state.nextBlockFuture.get(keepAliveIntervalMs, TimeUnit.MILLISECONDS);
                state.nextBlockFuture = null;
                return result;
            } catch (TimeoutException te) {
                webSocketPublisher.publishWaitingForPlan(simId, block);
            } catch (ExecutionException e) {
                log.error("[CLP] Error en planificación paralela del bloque {}: {}",
                        block, e.getCause() != null ? e.getCause().getMessage() : e.getMessage());
                state.nextBlockFuture = null;
                return new SimulationBlock(block, blockStart, blockEnd, 0);
            }
        }
    }

    private SimulationBlock planBlock(Long simId, ClpSimulation sim, LocalDateTime blockStart,
                                      LocalDateTime blockEnd, int blockIndex,
                                      LocalDateTime readUntilLimit) {
        try {
            List<ClpBaggageBatch> pending = batchRepo.findUnroutedBatches(blockEnd);
            if (pending.isEmpty()) {
                return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
            }
            if (pending.size() > maxBatchesPerBlock) {
                pending = pending.subList(0, maxBatchesPerBlock);
            }

            LocalDateTime flightLookahead = blockStart.plusHours(flightLookaheadHours);
            List<ClpFlight> flights = flightRepo.findScheduledBetween(blockStart, flightLookahead);
            List<ClpAirport> airports = airportRepo.findAll();

            if (flights.isEmpty()) {
                log.warn("[CLP-{}] bloque {} sin vuelos disponibles", simId, blockIndex);
            }

            AlnsParams alnsParams = plannerService.buildAlnsParams(sim);

            final int bi = blockIndex;
            plannerService.plan(airports, flights, pending, blockStart, alnsParams,
                    snap -> webSocketPublisher.publishPlanProgress(simId,
                            new PlanProgressSnapshot(
                                    snap.phase(), snap.iteration(), snap.maxIterations(),
                                    snap.assignedBatches(), snap.totalBatches(), snap.currentObjective(),
                                    bi, -1,
                                    blockStart.toString(), blockEnd.toString())));

            return new SimulationBlock(blockIndex, blockStart, blockEnd, pending.size());

        } catch (Exception e) {
            log.error("[CLP] Error planificando bloque {}: {}", blockIndex, e.getMessage(), e);
            return new SimulationBlock(blockIndex, blockStart, blockEnd, 0);
        }
    }

    /**
     * Plays a block tick by tick. Returns true if collapse was detected.
     */
    private boolean playBlock(Long simId, SimulationBlock block, ClpOrchestratorState state)
            throws InterruptedException {
        LocalDateTime blockEnd = block.end();

        while (true) {
            if (state.stopped) break;
            waitIfPaused(state);
            if (state.stopped) break;

            ClpSimulationEngine.TickResult result = simulationEngine.tick(simId);
            if (result == null) break;

            // *** COLLAPSE DETECTED ***
            if (result.collapsed()) {
                handleCollapse(simId, result.simNow(), result.collapsedAirport(), result.collapseReason());
                return true;
            }

            boolean blockDone = !result.simNow().isBefore(blockEnd);
            Thread.sleep(tickIntervalMs);
            if (blockDone) break;
        }
        return false;
    }

    private void handleCollapse(Long simId, LocalDateTime simNow,
                                 ClpAirport collapsedAirport, String collapseReason) {
        String iata = collapsedAirport != null ? collapsedAirport.getIataCode() : null;

        simulationRepo.findById(simId).ifPresent(sim -> {
            sim.setCollapsedAt(simNow);
            sim.setCollapsedAirport(collapsedAirport);
            sim.setStatus(SimulationStatus.FINISHED);
            simulationRepo.save(sim);
        });

        String message = collapseReason != null
                ? "¡COLAPSO! " + collapseReason
                : "¡COLAPSO! Aeropuerto " + (iata != null ? iata : "?") + " superó el 100% de capacidad.";

        webSocketPublisher.publishAlert(simId,
                new WebSocketEventPublisher.AlertEvent(
                        "COLLAPSE", null, null,
                        iata,
                        message,
                        simNow.toString()));

        webSocketPublisher.publishFinished(simId, true, iata);
    }

    private void waitIfPaused(ClpOrchestratorState state) throws InterruptedException {
        if (!state.paused) return;
        synchronized (state) {
            while (state.paused && !state.stopped) { state.wait(500); }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    @Transactional
    protected void setStatus(Long simId, SimulationStatus status) {
        simulationRepo.findById(simId).ifPresent(s -> {
            s.setStatus(status);
            simulationRepo.save(s);
        });
    }

    @Transactional
    protected void updateLastReadUntil(Long simId, LocalDateTime readUntil) {
        simulationRepo.findById(simId).ifPresent(s -> {
            s.setLastReadUntil(readUntil);
            simulationRepo.save(s);
        });
    }

    @Transactional
    protected void updateDaysSimulated(Long simId, int days) {
        simulationRepo.findById(simId).ifPresent(s -> {
            s.setDaysSimulated(days);
            simulationRepo.save(s);
        });
    }

    // ─── State ────────────────────────────────────────────────────────────────

    static class ClpOrchestratorState {
        volatile boolean paused = false;
        volatile boolean stopped = false;
        Thread thread;
        final ExecutorService plannerExecutor;
        volatile Future<SimulationBlock> nextBlockFuture;

        ClpOrchestratorState(Long simId) {
            int seq = plannerThreadCounter.incrementAndGet();
            this.plannerExecutor = Executors.newSingleThreadExecutor(
                    r -> new Thread(r, "clp-planner-bg-" + simId + "-" + seq));
        }
    }
}