package pe.pucp.tasfb2b.simulation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.*;
import pe.pucp.tasfb2b.dto.response.SimulationTickEvent;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.service.AirportService;
import pe.pucp.tasfb2b.service.PlannerService;
import pe.pucp.tasfb2b.websocket.WebSocketEventPublisher;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationEngine {

    /** Returned by {@link #manualCancelFlight} so callers know which instance was targeted. */
    public record ManualCancelResult(Long cancelledFlightId, LocalDateTime cancelledDeparture, boolean appliedNextDay) {}

    private static final long CANCEL_CUTOFF_MINUTES = 60L;

    // Cada cuántos ticks se reintenta rutear los lotes que quedaron sin ruta tras un
    // replan fallido (2 horas simuladas con ticks de 30 min).
    private static final int STRANDED_RETRY_TICKS = 4;

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final SimulationRepository simulationRepo;
    private final FlightRepository flightRepo;
    private final BaggageBatchRepository batchRepo;
    private final ShipmentRepository shipmentRepo;
    private final RouteLegRepository routeLegRepo;
    private final KpiSnapshotRepository kpiSnapshotRepo;
    private final FlightCancellationRepository cancellationRepo;
    private final ShipmentStatusHistoryRepository statusHistoryRepo;
    private final AirportRepository airportRepo;
    private final RouteRepository routeRepo;
    private final PlannerService plannerService;
    private final WebSocketEventPublisher eventPublisher;
    private final AirportService airportService;

    @Value("${tasf.simulation.tick-duration-minutes:30}")
    private int tickDurationMinutes;

    @Value("${tasf.simulation.default-threshold-amber:75}")
    private double thresholdAmber;

    @Value("${tasf.simulation.default-threshold-red:90}")
    private double thresholdRed;

    // Runtime state per simulation (not persisted)
    private final ConcurrentHashMap<Long, SimulationRuntimeState> runtimeStates = new ConcurrentHashMap<>();

    // Lotes cuyo replan no encontró ruta (banco del ALNS o error) — se reintentan
    // periódicamente en tick() en vez de quedar varados en silencio hasta vencer su SLA.
    private final ConcurrentHashMap<Long, Set<Long>> strandedBatches = new ConcurrentHashMap<>();

    // Single-threaded executor for post-cancellation replanning so it never blocks a tick
    private final ExecutorService replanExecutor = Executors.newSingleThreadExecutor(
            r -> new Thread(r, "replan-bg"));


    public void initSimulation(Long simulationId) {
        Simulation sim = simulationRepo.findById(simulationId).orElseThrow();
        LocalDateTime simStart = sim.getStartDate();
        LocalDateTime resumeFrom = sim.getSimulatedTime() != null ? sim.getSimulatedTime() : simStart;
        SimulationClock clock = new SimulationClock(simStart, resumeFrom, tickDurationMinutes);
        long startNano = System.currentTimeMillis();
        // Semilla derivada del punto de reanudación: al pausar/reanudar NO se repite la
        // misma secuencia de sorteos de cancelación desde cero (sigue siendo determinista
        // para una misma semilla y mismos puntos de pausa).
        long rngSeed = sim.getSeed() ^ resumeFrom.toEpochSecond(java.time.ZoneOffset.UTC);
        runtimeStates.put(simulationId, new SimulationRuntimeState(clock, startNano, new Random(rngSeed)));
        log.info("Motor de simulación inicializado para simulación {} (simStart={} resumeFrom={})",
                simulationId, simStart, resumeFrom);
    }

    @Transactional
    public LocalDateTime tick(Long simulationId) {
        try {
            Simulation sim = simulationRepo.findById(simulationId).orElse(null);
            if (sim == null || sim.getStatus() != SimulationStatus.PLAYING) return null;

            SimulationRuntimeState state = runtimeStates.get(simulationId);
            if (state == null) {
                initSimulation(simulationId);
                state = runtimeStates.get(simulationId);
            }

            SimulationClock clock = state.clock;
            int tickNum = clock.getTickCount(); // before advance
            long tickWall = System.currentTimeMillis();

            LocalDateTime simNow = clock.advance();
            log.debug("[SIM-{}] tick#{} simTime={} realElapsed={}s",
                    simulationId, tickNum, simNow.format(TIME_FMT), state.elapsedRealSeconds());

            sim.setSimulatedTime(simNow);
            simulationRepo.save(sim);

            // 1. Land arrived flights
            long t0 = System.currentTimeMillis();
            int arrivedCount = processArrivals(simNow);
            log.debug("[SIM-{}] tick#{} arrivals={} ({}ms)", simulationId, tickNum, arrivedCount, System.currentTimeMillis() - t0);

            // 2. Depart scheduled flights
            long t1 = System.currentTimeMillis();
            int departedCount = processDepartures(simNow);
            log.debug("[SIM-{}] tick#{} departures={} ({}ms)", simulationId, tickNum, departedCount, System.currentTimeMillis() - t1);

            // 3. Generate cancellations
            long t2 = System.currentTimeMillis();
            processCancellations(sim, state.rng, simNow, simulationId);
            log.debug("[SIM-{}] tick#{} cancellations ({}ms)", simulationId, tickNum, System.currentTimeMillis() - t2);

            // 3.5 Retry batches left without a route by an earlier failed replan
            retryStrandedBatches(sim, simNow, simulationId, tickNum);

            // 4. Check SLA violations
            long t3 = System.currentTimeMillis();
            checkSlaViolations(sim, simNow, simulationId);
            log.debug("[SIM-{}] tick#{} slaCheck ({}ms)", simulationId, tickNum, System.currentTimeMillis() - t3);

            // 5. Update airport occupancy
            long t4 = System.currentTimeMillis();
            updateAirportOccupancy(simNow);
            log.debug("[SIM-{}] tick#{} occupancy ({}ms)", simulationId, tickNum, System.currentTimeMillis() - t4);

            // 6. Persist KPI snapshot
            long t5 = System.currentTimeMillis();
            KpiSnapshot kpi = persistKpi(sim, simNow);
            log.debug("[SIM-{}] tick#{} kpi ({}ms)", simulationId, tickNum, System.currentTimeMillis() - t5);

            long processingMs = System.currentTimeMillis() - tickWall;
            log.debug("[SIM-{}] tick#{} processing={}ms", simulationId, tickNum, processingMs);

            // Log simulated speed ratio every 10 ticks (simulated min advanced / real seconds elapsed)
            if (tickNum > 0 && tickNum % 10 == 0) {
                long realMs = System.currentTimeMillis() - state.startMillis;
                long simMs = (long) tickNum * tickDurationMinutes * 60_000L;
                double ratio = realMs > 0 ? (double) simMs / realMs : 0;
                log.info("[SIM-{}] speed: {}x realtime | tick#{} simTime={} realElapsed={}s",
                        simulationId, String.format("%.1f", ratio), tickNum,
                        simNow.format(TIME_FMT), state.elapsedRealSeconds());
            }

            // 7. Publish WebSocket event after transaction commits so subscribers see committed data
            final long elapsedSec = state.elapsedRealSeconds();
            final SimulationClock clockRef = clock;
            final KpiSnapshot kpiRef = kpi;
            final Simulation simRef = sim;
            final LocalDateTime simNowRef = simNow;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publishTick(simRef, simNowRef, clockRef, kpiRef, elapsedSec);
                }
            });

            return simNow;

        } catch (Exception e) {
            log.error("Error en tick de simulación {}: {}", simulationId, e.getMessage(), e);
            return null;
        }
    }

    private int processArrivals(LocalDateTime simNow) {
        List<Flight> arriving = flightRepo.findInFlightArriving(FlightStatus.IN_FLIGHT, simNow);
        for (Flight flight : arriving) {
            flight.setStatus(FlightStatus.LANDED);
            flight.setCurrentLoad(0);

            List<RouteLeg> activeLegs = routeLegRepo
                    .findByFlightIdAndStatusWithBatch(flight.getId(), RouteLegStatus.IN_FLIGHT);

            for (RouteLeg leg : activeLegs) {
                leg.setStatus(RouteLegStatus.COMPLETED);

                Route route = leg.getRoute();
                List<RouteLeg> allLegs = routeLegRepo.findByRouteIdOrderByLegOrder(route.getId());

                boolean isLastLeg = allLegs.stream()
                        .filter(l -> l.getLegOrder() > leg.getLegOrder())
                        .noneMatch(l -> l.getStatus() != RouteLegStatus.CANCELLED);

                Shipment shipment = route.getShipment();
                BaggageBatch batch = shipment.getBaggageBatch();

                if (isLastLeg) {
                    String oldStatus = shipment.getStatus().name();
                    shipment.setStatus(ShipmentStatus.DELIVERED);
                    shipment.setDeliveredAt(simNow);
                    shipmentRepo.save(shipment);

                    batch.setStatus(BatchStatus.DELIVERED);
                    batchRepo.save(batch);

                    route.setActualArrival(simNow);
                    routeRepo.save(route);

                    recordStatusChange(shipment, oldStatus, "DELIVERED",
                            flight.getDestinationAirport(), simNow);

                    log.debug("Lote {} entregado en {}", batch.getId(),
                            flight.getDestinationAirport().getIataCode());
                } else {
                    RouteLeg nextLeg = allLegs.stream()
                            .filter(l -> l.getLegOrder() == leg.getLegOrder() + 1)
                            .findFirst()
                            .orElse(null);

                    if (nextLeg != null) {
                        String oldStatus = shipment.getStatus().name();
                        shipment.setStatus(ShipmentStatus.IN_TRANSIT);
                        shipmentRepo.save(shipment);
                        recordStatusChange(shipment, oldStatus, "IN_TRANSIT",
                                flight.getDestinationAirport(), simNow);
                    }
                }
            }
            routeLegRepo.saveAll(activeLegs);
        }
        flightRepo.saveAll(arriving);
        return arriving.size();
    }

    private int processDepartures(LocalDateTime simNow) {
        List<Flight> departing = flightRepo.findScheduledDeparting(FlightStatus.SCHEDULED, simNow);
        for (Flight flight : departing) {
            flight.setStatus(FlightStatus.IN_FLIGHT);

            List<RouteLeg> pendingLegs = routeLegRepo
                    .findByFlightIdAndStatusWithBatch(flight.getId(), RouteLegStatus.PENDING);
            int bagsBoarding = 0;
            for (RouteLeg leg : pendingLegs) {
                leg.setStatus(RouteLegStatus.IN_FLIGHT);

                Shipment shipment = leg.getRoute().getShipment();
                String oldStatus = shipment.getStatus().name();
                shipment.setStatus(ShipmentStatus.IN_TRANSIT);
                shipmentRepo.save(shipment);

                BaggageBatch batch = shipment.getBaggageBatch();
                bagsBoarding += batch.getQuantity();
                batch.setStatus(BatchStatus.IN_TRANSIT);
                batchRepo.save(batch);

                recordStatusChange(shipment, oldStatus, "IN_TRANSIT",
                        flight.getOriginAirport(), simNow);
            }
            routeLegRepo.saveAll(pendingLegs);
            flight.setCurrentLoad(bagsBoarding);
        }
        flightRepo.saveAll(departing);
        return departing.size();
    }

    private void processCancellations(Simulation sim, Random rng, LocalDateTime simNow,
                                       Long simulationId) {
        double rate = sim.getCancellationRate().doubleValue() / 100.0;
        if (rate <= 0) return;

        // Only consider flights departing in this tick window so each flight
        // gets exactly one cancellation opportunity (prevents over-cancellation).
        LocalDateTime nextTick = simNow.plusMinutes(tickDurationMinutes);
        List<Flight> scheduled = flightRepo.findScheduledInWindow(FlightStatus.SCHEDULED, simNow, nextTick);
        for (Flight flight : scheduled) {
            try {
                if (rng.nextDouble() >= rate) continue;
                cancelFlightAndReplan(flight, sim, simNow, simulationId, "Cancelación automática por simulación");
            } catch (Exception e) {
                log.error("Error crítico al procesar cancelación del vuelo {}: {}", flight.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public ManualCancelResult manualCancelFlight(Long flightId, Long simulationId) {
        Flight selected = flightRepo.findById(flightId)
                .orElseThrow(() -> new IllegalArgumentException("Vuelo no encontrado: " + flightId));
        if (selected.getStatus() != FlightStatus.SCHEDULED) {
            throw new IllegalStateException("Solo se pueden cancelar vuelos en estado SCHEDULED");
        }
        Simulation sim = simulationRepo.findById(simulationId)
                .orElseThrow(() -> new IllegalArgumentException("Simulación no encontrada: " + simulationId));
        if (sim.getStatus() != SimulationStatus.PLAYING && sim.getStatus() != SimulationStatus.PAUSED) {
            throw new IllegalStateException(
                    "Solo se pueden cancelar vuelos con la simulación en curso o pausada");
        }
        LocalDateTime simNow = sim.getSimulatedTime() != null ? sim.getSimulatedTime() : sim.getStartDate();

        long minutesUntilDep = Duration.between(simNow, selected.getDepartureTime()).toMinutes();
        boolean appliedNextDay = minutesUntilDep < CANCEL_CUTOFF_MINUTES;

        Flight target;
        String reason;
        if (!appliedNextDay) {
            target = selected;
            reason = "Cancelación manual por operador";
        } else {
            // <1h before departure → cancel the next scheduled instance on the same route
            List<Flight> next = flightRepo.findNextScheduledOnRoute(
                    selected.getOriginAirport().getId(),
                    selected.getDestinationAirport().getId(),
                    selected.getDepartureTime());
            if (next.isEmpty()) {
                throw new IllegalStateException(
                        "Quedan menos de 60 minutos para la salida y no hay vuelo siguiente en esta ruta");
            }
            target = next.get(0);
            reason = "Cancelación manual (regla <1h): instancia siguiente de la ruta";
        }

        cancelFlightAndReplan(target, sim, simNow, simulationId, reason);
        return new ManualCancelResult(target.getId(), target.getDepartureTime(), appliedNextDay);
    }

    private void cancelFlightAndReplan(Flight flight, Simulation sim, LocalDateTime simNow,
                                        Long simulationId, String reason) {
        flight.setStatus(FlightStatus.CANCELLED);
        flightRepo.save(flight);

        if (!cancellationRepo.existsByFlightId(flight.getId())) {
            cancellationRepo.save(new FlightCancellation(flight, simNow, reason));
        }

        log.info("Vuelo {} cancelado en simulación {} — {}", flight.getId(), simulationId, reason);

        List<RouteLeg> affectedLegs = routeLegRepo
                .findByFlightIdAndStatus(flight.getId(), RouteLegStatus.PENDING);

        if (affectedLegs.isEmpty()) return;

        List<BaggageBatch> affectedBatches = affectedLegs.stream()
                .map(leg -> leg.getRoute().getShipment().getBaggageBatch())
                .collect(Collectors.toList());

        for (RouteLeg leg : affectedLegs) {
            leg.setStatus(RouteLegStatus.CANCELLED);
            routeLegRepo.save(leg);
        }

        final Long fid = flight.getId();
        final List<Long> batchIdsForReplan = affectedBatches.stream()
                .map(BaggageBatch::getId).collect(Collectors.toList());

        registerReplanAfterCommit(sim, simNow, simulationId, batchIdsForReplan,
                new WebSocketEventPublisher.AlertEvent(
                        "CANCELLATION", null, fid, null,
                        "Vuelo cancelado. Replanificando " + batchIdsForReplan.size() + " lotes.",
                        simNow.format(TIME_FMT)),
                "cancelación de vuelo " + fid);
    }

    /**
     * Registra (para después del commit de la transacción actual) la publicación de la
     * alerta y la replanificación en background de los lotes indicados. Punto único de
     * entrada al replan: arma el contexto con la posición REAL de cada lote, la carga ya
     * comprometida de cada vuelo, y registra como "varados" los lotes que queden sin ruta.
     */
    private void registerReplanAfterCommit(Simulation sim, LocalDateTime simNow, Long simulationId,
                                            List<Long> batchIds,
                                            WebSocketEventPublisher.AlertEvent alertEvent,
                                            String replanCause) {
        final String algorithm = sim.getAlgorithm();
        final var alnsParams = plannerService.buildAlnsParams(sim);
        final LocalDateTime replanNow = simNow;

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                // Publicada recién tras el commit: si la transacción hiciera rollback,
                // el operador nunca ve una alerta de algo que no ocurrió.
                if (alertEvent != null) {
                    eventPublisher.publishAlert(simulationId, alertEvent);
                }
                replanExecutor.submit(() -> runReplan(simulationId, batchIds, algorithm,
                        alnsParams, replanNow, replanCause));
            }
        });
    }

    private void runReplan(Long simulationId, List<Long> batchIds, String algorithm,
                            pe.pucp.tasfb2b.planner.alns.AlnsParams alnsParams,
                            LocalDateTime replanNow, String replanCause) {
        try {
            long replanStart = System.currentTimeMillis();
            // Re-fetch batches/flights by ID (with JOIN FETCH on their airports)
            // instead of reusing the entities captured before this transaction
            // committed: those became detached lazy proxies once their loading
            // session closed, and this callback runs on a different thread/session.
            List<BaggageBatch> freshBatches = batchRepo.findByIdInWithAirports(batchIds);
            List<Flight> availableFlights = flightRepo.findByStatusWithAirports(FlightStatus.SCHEDULED);
            List<Airport> airports = airportRepo.findAll();

            SimulationContext ctx = SimulationContext.builder()
                    .airports(airports)
                    .flights(availableFlights)
                    .pendingBatches(freshBatches)
                    .simulatedNow(replanNow)
                    .alnsParams(alnsParams)
                    .replanOrigins(buildReplanOrigins(freshBatches, replanNow))
                    .flightBaseLoads(buildFlightBaseLoads())
                    .build();

            List<Long> routedIds = plannerService.replan(freshBatches, ctx, algorithm);
            log.info("[SIM-{}] replan ({}) batches={} routed={} in {}ms",
                    simulationId, replanCause, freshBatches.size(), routedIds.size(),
                    System.currentTimeMillis() - replanStart);

            trackStrandedBatches(simulationId, batchIds, routedIds, replanNow);
        } catch (Exception e) {
            log.error("Error en replanificación ({}): {}", replanCause, e.getMessage(), e);
            trackStrandedBatches(simulationId, batchIds, List.of(), replanNow);
        }
    }

    /**
     * Posición física y hora mínima de embarque de cada lote: el destino de su último
     * tramo COMPLETED (u origen si nunca voló). Se exige además un margen de un tick
     * sobre el "ahora" simulado para no asignar vuelos que despegarían antes de que
     * esta replanificación asíncrona alcance a persistirse.
     */
    private Map<Long, SimulationContext.ReplanOrigin> buildReplanOrigins(
            List<BaggageBatch> batches, LocalDateTime replanNow) {
        List<Long> ids = batches.stream().map(BaggageBatch::getId).collect(Collectors.toList());
        Map<Long, RouteLeg> lastCompletedByBatch = new HashMap<>();
        for (RouteLeg leg : routeLegRepo.findCompletedLegsByBatchIds(ids)) {
            Long batchId = leg.getRoute().getShipment().getBaggageBatch().getId();
            RouteLeg current = lastCompletedByBatch.get(batchId);
            if (current == null || leg.getLegOrder() > current.getLegOrder()) {
                lastCompletedByBatch.put(batchId, leg);
            }
        }

        LocalDateTime earliestDeparture = replanNow.plusMinutes(tickDurationMinutes);
        Map<Long, SimulationContext.ReplanOrigin> origins = new HashMap<>();
        for (BaggageBatch batch : batches) {
            RouteLeg last = lastCompletedByBatch.get(batch.getId());
            String currentIata = last != null
                    ? last.getFlight().getDestinationAirport().getIataCode()
                    : batch.getOriginAirport().getIataCode();
            LocalDateTime notBefore = last != null
                    ? earliestDeparture
                    : (batch.getAvailableFrom().isAfter(earliestDeparture)
                            ? batch.getAvailableFrom() : earliestDeparture);
            origins.put(batch.getId(), new SimulationContext.ReplanOrigin(currentIata, notBefore));
        }
        return origins;
    }

    /**
     * Maletas ya comprometidas por tramo PENDING en cada vuelo programado. Los tramos de
     * los lotes en replan ya fueron marcados CANCELLED antes del commit, así que esta
     * suma refleja solo la carga de los lotes NO afectados — exactamente la base que el
     * ALNS debe respetar para no sobrevender bodega.
     */
    private Map<Long, Integer> buildFlightBaseLoads() {
        return routeLegRepo.sumPendingBagsByFlightId().stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> ((Long) row[1]).intValue()));
    }

    /** Registra los lotes que quedaron sin ruta, alertando solo los nuevos (evita spam). */
    private void trackStrandedBatches(Long simulationId, List<Long> attempted,
                                       List<Long> routedIds, LocalDateTime simNow) {
        Set<Long> stranded = strandedBatches.computeIfAbsent(
                simulationId, k -> ConcurrentHashMap.newKeySet());
        routedIds.forEach(stranded::remove);

        List<Long> newlyStranded = new ArrayList<>();
        for (Long id : attempted) {
            if (!routedIds.contains(id) && stranded.add(id)) {
                newlyStranded.add(id);
            }
        }
        if (newlyStranded.isEmpty()) return;

        log.warn("[SIM-{}] replan sin ruta para {} lotes {} — se reintentará periódicamente",
                simulationId, newlyStranded.size(), newlyStranded);
        eventPublisher.publishAlert(simulationId,
                new WebSocketEventPublisher.AlertEvent(
                        "REPLAN_FAILED", null, null, null,
                        "No se encontró ruta para " + newlyStranded.size()
                                + " lote(s). Se reintentará automáticamente.",
                        simNow.format(TIME_FMT)));
    }

    /** Reintenta rutear los lotes varados cada STRANDED_RETRY_TICKS ticks. */
    private void retryStrandedBatches(Simulation sim, LocalDateTime simNow,
                                       Long simulationId, int tickNum) {
        if (tickNum == 0 || tickNum % STRANDED_RETRY_TICKS != 0) return;
        Set<Long> stranded = strandedBatches.get(simulationId);
        if (stranded == null || stranded.isEmpty()) return;

        List<Long> toRetry = new ArrayList<>(stranded);
        log.info("[SIM-{}] reintentando replan de {} lotes varados", simulationId, toRetry.size());
        registerReplanAfterCommit(sim, simNow, simulationId, toRetry,
                null, "reintento de lotes varados");
    }

    private void checkSlaViolations(Simulation sim, LocalDateTime simNow, Long simulationId) {
        List<Shipment> overdue = shipmentRepo.findOverdueShipments(simNow);
        if (overdue.isEmpty()) return;

        List<BaggageBatch> batchesForReplan = new ArrayList<>();
        for (Shipment shipment : overdue) {
            if (shipment.getStatus() == ShipmentStatus.DELAYED) continue;
            String oldStatus = shipment.getStatus().name();
            shipment.setStatus(ShipmentStatus.DELAYED);
            shipmentRepo.save(shipment);

            BaggageBatch batch = shipment.getBaggageBatch();
            batch.setStatus(BatchStatus.DELAYED);
            batchRepo.save(batch);

            recordStatusChange(shipment, oldStatus, "DELAYED", null, simNow);
            log.warn("Envío {} marcado como DELAYED (deadline: {})", shipment.getId(), shipment.getDeadline());

            // Only the still-grounded portion of the trip can be redirected — a batch
            // already on its final in-flight leg has no PENDING legs left to replan.
            List<RouteLeg> pendingLegs = routeLegRepo.findPendingLegsByShipmentId(shipment.getId());
            if (pendingLegs.isEmpty()) continue;

            for (RouteLeg leg : pendingLegs) {
                leg.setStatus(RouteLegStatus.CANCELLED);
                routeLegRepo.save(leg);
            }
            batchesForReplan.add(batch);
        }

        if (batchesForReplan.isEmpty()) return;
        scheduleDelayReplan(sim, simNow, simulationId, batchesForReplan);
    }

    private void scheduleDelayReplan(Simulation sim, LocalDateTime simNow, Long simulationId,
                                      List<BaggageBatch> batchesForReplan) {
        final List<Long> batchIds = batchesForReplan.stream()
                .map(BaggageBatch::getId).collect(Collectors.toList());

        registerReplanAfterCommit(sim, simNow, simulationId, batchIds,
                new WebSocketEventPublisher.AlertEvent(
                        "DELAY", null, null, null,
                        "Detectados " + batchIds.size() + " lotes retrasados. Replanificando.",
                        simNow.format(TIME_FMT)),
                "lotes retrasados");
    }

    private void updateAirportOccupancy(LocalDateTime simNow) {
        List<Airport> airports = airportRepo.findAll();

        // Only count bags physically present at origin (availableFrom has passed) and not yet departed
        List<BaggageBatch> waitingBatches = batchRepo.findPendingBatches(simNow);

        // Bags delivered within the last 15 simulated minutes still occupy destination storage
        List<BaggageBatch> deliveredBatches = batchRepo.findRecentlyDelivered(simNow.minusMinutes(15));

        // IN_TRANSIT bags sitting at intermediate connecting airports (not on any plane)
        List<RouteLeg> intermediateLegs = routeLegRepo.findFirstPendingLegsOfTransitBagsAtIntermediateStops();
        Map<Long, Long> intermediateBagsByAirport = intermediateLegs.stream()
                .collect(Collectors.groupingBy(
                        rl -> rl.getFlight().getOriginAirport().getId(),
                        Collectors.summingLong(rl -> rl.getRoute().getShipment().getBaggageBatch().getQuantity())
                ));

        for (Airport airport : airports) {
            long waiting = waitingBatches.stream()
                    .filter(b -> b.getOriginAirport().getId().equals(airport.getId()))
                    .mapToLong(BaggageBatch::getQuantity)
                    .sum();
            long delivered = deliveredBatches.stream()
                    .filter(b -> b.getDestinationAirport().getId().equals(airport.getId()))
                    .mapToLong(BaggageBatch::getQuantity)
                    .sum();
            long intermediate = intermediateBagsByAirport.getOrDefault(airport.getId(), 0L);
            int occupancy = (int) Math.min(waiting + delivered + intermediate, airport.getWarehouseCapacity());
            airport.setCurrentOccupancy(occupancy);

            double pct = airport.getOccupancyPct();
            if (pct >= thresholdRed) {
                log.warn("Aeropuerto {} en nivel CRÍTICO: {}%", airport.getIataCode(),
                        String.format("%.1f", pct));
            }
        }
        airportRepo.saveAll(airports);
    }

    private KpiSnapshot persistKpi(Simulation sim, LocalDateTime simNow) {
        long total = shipmentRepo.countTotal();
        long delivered = shipmentRepo.countDelivered();
        long onTime = shipmentRepo.countOnTimeDeliveries();
        long delayed = shipmentRepo.countByStatus(ShipmentStatus.DELAYED);

        double onTimePct = total > 0 ? (double) onTime / total * 100.0 : 100.0;

        // Ocupación de flota = (maletas en vuelo + maletas asignadas a vuelos programados)
        // / (capacidad total de todos los vuelos activos), no un promedio de porcentajes.
        List<Flight> activeFleet = flightRepo.findByStatusIn(
                List.of(FlightStatus.SCHEDULED, FlightStatus.IN_FLIGHT));
        Map<Long, Long> pendingBagsByFlight = routeLegRepo.sumPendingBagsByFlightId().stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
        long fleetLoad = 0L;
        long fleetCapacity = 0L;
        for (Flight f : activeFleet) {
            fleetCapacity += f.getBaggageCapacity();
            fleetLoad += f.getStatus() == FlightStatus.IN_FLIGHT
                    ? f.getCurrentLoad()
                    : pendingBagsByFlight.getOrDefault(f.getId(), 0L);
        }
        double avgFlightOcc = fleetCapacity > 0 ? (double) fleetLoad / fleetCapacity * 100.0 : 0.0;

        // Ocupación de aeropuertos = (maletas en todos los aeropuertos) / (capacidad total
        // de todos los aeropuertos), no un promedio de porcentajes por aeropuerto.
        List<Airport> airports = airportRepo.findAll();
        long warehouseLoad = airports.stream().mapToLong(Airport::getCurrentOccupancy).sum();
        long warehouseCapacity = airports.stream().mapToLong(Airport::getWarehouseCapacity).sum();
        double avgWarehouseOcc = warehouseCapacity > 0 ? (double) warehouseLoad / warehouseCapacity * 100.0 : 0.0;

        KpiSnapshot snapshot = new KpiSnapshot();
        snapshot.setSimulation(sim);
        snapshot.setSnapshotTime(simNow);
        snapshot.setOnTimePct(BigDecimal.valueOf(onTimePct).setScale(2, RoundingMode.HALF_UP));
        snapshot.setDelayedCount((int) delayed);
        snapshot.setAvgFlightOccupancy(BigDecimal.valueOf(avgFlightOcc).setScale(2, RoundingMode.HALF_UP));
        snapshot.setAvgWarehouseOccupancy(BigDecimal.valueOf(avgWarehouseOcc).setScale(2, RoundingMode.HALF_UP));

        return kpiSnapshotRepo.save(snapshot);
    }

    private void publishTick(Simulation sim, LocalDateTime simNow, SimulationClock clock,
                              KpiSnapshot kpi, long elapsedSec) {
        long pubStart = System.currentTimeMillis();
        List<Airport> airports = airportRepo.findAll();
        List<Flight> activeFlights = flightRepo.findAssignedFlightsForTick(simNow.plusHours(24), simNow.minusHours(1));

        // currentLoad solo se fija al despegar; para vuelos SCHEDULED la carga real son
        // las maletas de sus tramos PENDING — sin esto el panel de cancelación muestra
        // "0 maletas" para todo vuelo aún no despegado.
        Map<Long, Long> pendingBagsByFlight = routeLegRepo.sumPendingBagsByFlightId().stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));

        List<SimulationTickEvent.AirportPayload> airportPayloads = airports.stream()
                .map(a -> {
                    double pct = a.getOccupancyPct();
                    return SimulationTickEvent.AirportPayload.builder()
                            .iata(a.getIataCode())
                            .occupancyPct(pct)
                            .semaphoreLevel(airportService.getSemaphoreLevel(pct, thresholdAmber, thresholdRed).name())
                            .currentOccupancy(a.getCurrentOccupancy())
                            .build();
                })
                .collect(Collectors.toList());

        List<SimulationTickEvent.FlightPayload> flightPayloads = activeFlights.stream()
                .filter(f -> f.getStatus() != FlightStatus.LANDED)
                .map(f -> SimulationTickEvent.FlightPayload.builder()
                        .flightId(f.getId())
                        .originIata(f.getOriginAirport().getIataCode())
                        .destinationIata(f.getDestinationAirport().getIataCode())
                        .progress(f.getProgress(simNow))
                        .status(f.getStatus().name())
                        .baggageCapacity(f.getBaggageCapacity())
                        .currentLoad(f.getStatus() == FlightStatus.SCHEDULED
                                ? pendingBagsByFlight.getOrDefault(f.getId(), 0L).intValue()
                                : f.getCurrentLoad())
                        .departureTime(f.getDepartureTime() != null ? f.getDepartureTime().toString() + "Z" : null)
                        .arrivalTime(f.getArrivalTime() != null ? f.getArrivalTime().toString() + "Z" : null)
                        .airlineName(f.getAirline() != null ? f.getAirline().getName() : null)
                        .build())
                .collect(Collectors.toList());

        long totalBags     = batchRepo.sumAllQuantity();
        long deliveredBags = batchRepo.sumQuantityByStatus(BatchStatus.DELIVERED);
        long inTransitBags = batchRepo.sumQuantityByStatus(BatchStatus.IN_TRANSIT);
        long delayedBags   = batchRepo.sumQuantityByStatus(BatchStatus.DELAYED);
        long waitingBags   = batchRepo.sumQuantityByStatus(BatchStatus.IN_ORIGIN);

        // Shipment status counts for sidebar — countByStatus evita cargar entidades completas
        Map<String, Long> shipmentCounts = new HashMap<>();
        for (BatchStatus bs : BatchStatus.values()) {
            shipmentCounts.put(bs.name(), batchRepo.countByStatus(bs));
        }

        SimulationTickEvent event = SimulationTickEvent.builder()
                .simulationId(sim.getId())
                .simulationStatus(sim.getStatus().name())
                .simulatedDay(Math.min(clock.getSimulatedDay(), sim.getPeriodDays() != null ? sim.getPeriodDays() : 5))
                .simulatedTime(simNow.format(TIME_FMT) + " UTC")
                .simulatedIso(simNow.toString())
                .elapsedRealSeconds(elapsedSec)
                .kpis(SimulationTickEvent.KpisPayload.builder()
                        .onTimePct(kpi.getOnTimePct().doubleValue())
                        .delayedCount(kpi.getDelayedCount())
                        .avgFlightOcc(kpi.getAvgFlightOccupancy().doubleValue())
                        .avgWarehouseOcc(kpi.getAvgWarehouseOccupancy().doubleValue())
                        .build())
                .airports(airportPayloads)
                .flights(flightPayloads)
                .totalBags(totalBags)
                .deliveredBags(deliveredBags)
                .inTransitBags(inTransitBags)
                .waitingBags(waitingBags)
                .delayedBags(delayedBags)
                .shipmentCounts(shipmentCounts)
                .build();

        eventPublisher.publishTick(sim.getId(), event);
        log.debug("[SIM-{}] publishTick flights={} airports={} bags(total/del/transit/wait/delayed)={}/{}/{}/{}/{} in {}ms",
                sim.getId(), flightPayloads.size(), airportPayloads.size(),
                totalBags, deliveredBags, inTransitBags, waitingBags, delayedBags,
                System.currentTimeMillis() - pubStart);
    }

    private void recordStatusChange(Shipment shipment, String oldStatus, String newStatus,
                                     Airport airport, LocalDateTime changedAt) {
        ShipmentStatusHistory history = new ShipmentStatusHistory(
                shipment, oldStatus, newStatus, airport, changedAt);
        statusHistoryRepo.save(history);
    }

    public void removeState(Long simulationId) {
        runtimeStates.remove(simulationId);
        strandedBatches.remove(simulationId);
    }

    static class SimulationRuntimeState {
        final SimulationClock clock;
        final long startMillis;
        final Random rng;


        SimulationRuntimeState(SimulationClock clock, long startMillis, Random rng) {
            this.clock = clock;
            this.startMillis = startMillis;
            this.rng = rng;
        }

        long elapsedRealSeconds() {
            return (System.currentTimeMillis() - startMillis) / 1000;
        }
    }
}