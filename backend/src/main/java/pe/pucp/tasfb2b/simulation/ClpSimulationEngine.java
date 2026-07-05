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
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.service.AirportService;
import pe.pucp.tasfb2b.service.ClpPlannerService;
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
public class ClpSimulationEngine {

    private static final long CANCEL_CUTOFF_MINUTES = 60L;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final ClpSimulationRepository simulationRepo;
    private final ClpFlightRepository flightRepo;
    private final ClpBaggageBatchRepository batchRepo;
    private final ClpShipmentRepository shipmentRepo;
    private final ClpRouteLegRepository routeLegRepo;
    private final ClpKpiSnapshotRepository kpiSnapshotRepo;
    private final ClpFlightCancellationRepository cancellationRepo;
    private final ClpShipmentStatusHistoryRepository statusHistoryRepo;
    private final ClpAirportRepository airportRepo;
    private final ClpRouteRepository routeRepo;
    private final ClpPlannerService plannerService;
    private final WebSocketEventPublisher eventPublisher;
    private final AirportService airportService;

    @Value("${tasf.simulation.tick-duration-minutes:30}")
    private int tickDurationMinutes;

    @Value("${tasf.simulation.default-threshold-amber:75}")
    private double thresholdAmber;

    @Value("${tasf.simulation.default-threshold-red:90}")
    private double thresholdRed;

    private final ConcurrentHashMap<Long, ClpRuntimeState> runtimeStates = new ConcurrentHashMap<>();
    private final ExecutorService replanExecutor = Executors.newSingleThreadExecutor(
            r -> new Thread(r, "clp-replan-bg"));

    private static final int DELAYED_SHIPMENT_COLLAPSE_THRESHOLD = 2;

    /** Result of tick(): null = error/stopped, non-null = simNow + collapse info */
    public record TickResult(LocalDateTime simNow, boolean collapsed,
                              ClpAirport collapsedAirport, String collapseReason) {}

    public void initSimulation(Long simulationId) {
        ClpSimulation sim = simulationRepo.findById(simulationId).orElseThrow();
        LocalDateTime simStart = sim.getStartDate();
        LocalDateTime resumeFrom = sim.getSimulatedTime() != null ? sim.getSimulatedTime() : simStart;
        SimulationClock clock = new SimulationClock(simStart, resumeFrom, tickDurationMinutes);
        long startNano = System.currentTimeMillis();
        runtimeStates.put(simulationId, new ClpRuntimeState(clock, startNano, new Random(sim.getSeed())));
        log.info("[CLP] Motor inicializado para simulación {} (simStart={} resumeFrom={})",
                simulationId, simStart, resumeFrom);
    }

    @Transactional
    public TickResult tick(Long simulationId) {
        try {
            ClpSimulation sim = simulationRepo.findById(simulationId).orElse(null);
            if (sim == null || sim.getStatus() != SimulationStatus.PLAYING) return null;

            ClpRuntimeState state = runtimeStates.get(simulationId);
            if (state == null) {
                initSimulation(simulationId);
                state = runtimeStates.get(simulationId);
            }

            SimulationClock clock = state.clock;
            int tickNum = clock.getTickCount();
            long tickWall = System.currentTimeMillis();

            LocalDateTime simNow = clock.advance();

            sim.setSimulatedTime(simNow);
            simulationRepo.save(sim);

            // 1. Land arrived flights
            processArrivals(simNow);

            // 2. Depart scheduled flights
            processDepartures(simNow);

            // 3. Generate cancellations
            processCancellations(sim, state.rng, simNow, simulationId);

            // 4. Check SLA violations
            checkSlaViolations(simNow);

            // 5. Update airport occupancy
            updateAirportOccupancy(simNow);

            // 6. *** COLLAPSE CHECK *** — warehouse >100% OR delayed >= threshold
            TickResult collapseResult = checkCollapse(simNow);

            // 7. Persist KPI snapshot
            ClpKpiSnapshot kpi = persistKpi(sim, simNow);

            if (tickNum > 0 && tickNum % 10 == 0) {
                long realMs = System.currentTimeMillis() - state.startMillis;
                long simMs = (long) tickNum * tickDurationMinutes * 60_000L;
                double ratio = realMs > 0 ? (double) simMs / realMs : 0;
                log.info("[CLP-{}] speed: {}x realtime | tick#{} simTime={} realElapsed={}s",
                        simulationId, String.format("%.1f", ratio), tickNum,
                        simNow.format(TIME_FMT), state.elapsedRealSeconds());
            }

            // 8. Publish WebSocket event after commit
            final long elapsedSec = state.elapsedRealSeconds();
            final SimulationClock clockRef = clock;
            final ClpKpiSnapshot kpiRef = kpi;
            final ClpSimulation simRef = sim;
            final LocalDateTime simNowRef = simNow;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publishTick(simRef, simNowRef, clockRef, kpiRef, elapsedSec);
                }
            });

            return collapseResult != null
                    ? collapseResult
                    : new TickResult(simNow, false, null, null);

        } catch (Exception e) {
            log.error("[CLP] Error en tick de simulación {}: {}", simulationId, e.getMessage(), e);
            return null;
        }
    }

    // ── COLLAPSE DETECTION ──────────────────────────────────────────────────

    /** Checks both collapse conditions: warehouse >100% OR delayed shipments >= threshold */
    private TickResult checkCollapse(LocalDateTime simNow) {
        // Condition 1: Any airport warehouse above 100%
        List<ClpAirport> airports = airportRepo.findAll();
        for (ClpAirport a : airports) {
            if (a.getOccupancyPct() > 100.0) {
                log.warn("[CLP] ¡COLAPSO POR ALMACÉN! Aeropuerto {} al {}%",
                        a.getIataCode(), String.format("%.1f", a.getOccupancyPct()));
                return new TickResult(simNow, true, a,
                        "Almacén del aeropuerto " + a.getIataCode()
                                + " superó el 100% (" + String.format("%.1f", a.getOccupancyPct()) + "%)");
            }
        }

        // Condition 2: Delayed shipments >= threshold
        long delayedCount = shipmentRepo.countByStatus(ShipmentStatus.DELAYED);
        if (delayedCount >= DELAYED_SHIPMENT_COLLAPSE_THRESHOLD) {
            log.warn("[CLP] ¡COLAPSO POR RETRASOS! {} envíos retrasados (umbral: {})",
                    delayedCount, DELAYED_SHIPMENT_COLLAPSE_THRESHOLD);
            return new TickResult(simNow, true, null,
                    delayedCount + " envíos retrasados (umbral: " + DELAYED_SHIPMENT_COLLAPSE_THRESHOLD + ")");
        }

        return null; // no collapse
    }

    // ── Same logic as SimulationEngine but using Clp entities ────────────────

    private void processArrivals(LocalDateTime simNow) {
        List<ClpFlight> arriving = flightRepo.findInFlightArriving(FlightStatus.IN_FLIGHT, simNow);
        for (ClpFlight flight : arriving) {
            flight.setStatus(FlightStatus.LANDED);
            flight.setCurrentLoad(0);

            List<ClpRouteLeg> activeLegs = routeLegRepo
                    .findByFlightIdAndStatusWithBatch(flight.getId(), RouteLegStatus.IN_FLIGHT);

            for (ClpRouteLeg leg : activeLegs) {
                leg.setStatus(RouteLegStatus.COMPLETED);

                ClpRoute route = leg.getRoute();
                List<ClpRouteLeg> allLegs = routeLegRepo.findByRouteIdOrderByLegOrder(route.getId());

                boolean isLastLeg = allLegs.stream()
                        .filter(l -> l.getLegOrder() > leg.getLegOrder())
                        .noneMatch(l -> l.getStatus() != RouteLegStatus.CANCELLED);

                ClpShipment shipment = route.getShipment();
                ClpBaggageBatch batch = shipment.getBaggageBatch();

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
                } else {
                    ClpRouteLeg nextLeg = allLegs.stream()
                            .filter(l -> l.getLegOrder() == leg.getLegOrder() + 1)
                            .findFirst().orElse(null);
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
    }

    private void processDepartures(LocalDateTime simNow) {
        List<ClpFlight> departing = flightRepo.findScheduledDeparting(FlightStatus.SCHEDULED, simNow);
        for (ClpFlight flight : departing) {
            flight.setStatus(FlightStatus.IN_FLIGHT);

            List<ClpRouteLeg> pendingLegs = routeLegRepo
                    .findByFlightIdAndStatusWithBatch(flight.getId(), RouteLegStatus.PENDING);
            int bagsBoarding = 0;
            for (ClpRouteLeg leg : pendingLegs) {
                leg.setStatus(RouteLegStatus.IN_FLIGHT);

                ClpShipment shipment = leg.getRoute().getShipment();
                String oldStatus = shipment.getStatus().name();
                shipment.setStatus(ShipmentStatus.IN_TRANSIT);
                shipmentRepo.save(shipment);

                ClpBaggageBatch batch = shipment.getBaggageBatch();
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
    }

    private void processCancellations(ClpSimulation sim, Random rng, LocalDateTime simNow,
                                       Long simulationId) {
        double rate = sim.getCancellationRate().doubleValue() / 100.0;
        if (rate <= 0) return;

        LocalDateTime nextTick = simNow.plusMinutes(tickDurationMinutes);
        List<ClpFlight> scheduled = flightRepo.findScheduledInWindow(FlightStatus.SCHEDULED, simNow, nextTick);
        for (ClpFlight flight : scheduled) {
            try {
                if (rng.nextDouble() >= rate) continue;
                cancelFlightAndReplan(flight, sim, simNow, simulationId,
                        "Cancelación automática por simulación de colapso");
            } catch (Exception e) {
                log.error("[CLP] Error cancelando vuelo {}: {}", flight.getId(), e.getMessage());
            }
        }
    }

    private void cancelFlightAndReplan(ClpFlight flight, ClpSimulation sim, LocalDateTime simNow,
                                        Long simulationId, String reason) {
        flight.setStatus(FlightStatus.CANCELLED);
        flightRepo.save(flight);

        if (!cancellationRepo.existsByFlightId(flight.getId())) {
            cancellationRepo.save(new ClpFlightCancellation(flight, simNow, reason));
        }

        List<ClpRouteLeg> affectedLegs = routeLegRepo
                .findByFlightIdAndStatus(flight.getId(), RouteLegStatus.PENDING);
        if (affectedLegs.isEmpty()) return;

        List<ClpBaggageBatch> affectedBatches = affectedLegs.stream()
                .map(leg -> leg.getRoute().getShipment().getBaggageBatch())
                .collect(Collectors.toList());

        for (ClpRouteLeg leg : affectedLegs) {
            leg.setStatus(RouteLegStatus.CANCELLED);
            routeLegRepo.save(leg);
        }

        final Long fid = flight.getId();
        final List<ClpBaggageBatch> batchesForReplan = List.copyOf(affectedBatches);
        final var alnsParams = plannerService.buildAlnsParams(sim);
        final LocalDateTime replanNow = simNow;

        eventPublisher.publishAlert(simulationId,
                new WebSocketEventPublisher.AlertEvent(
                        "CANCELLATION", null, fid, null,
                        "[CLP] Vuelo cancelado. Replanificando " + batchesForReplan.size() + " lotes.",
                        simNow.format(TIME_FMT)));

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                replanExecutor.submit(() -> {
                    try {
                        List<ClpFlight> availableFlights = flightRepo.findByStatus(FlightStatus.SCHEDULED);
                        List<ClpAirport> airports = airportRepo.findAll();
                        plannerService.replan(batchesForReplan, airports, availableFlights,
                                replanNow, alnsParams);
                    } catch (Exception e) {
                        log.error("[CLP] Error en replanificación tras cancelación de vuelo {}: {}",
                                fid, e.getMessage());
                    }
                });
            }
        });
    }

    private void checkSlaViolations(LocalDateTime simNow) {
        List<ClpShipment> overdue = shipmentRepo.findOverdueShipments(simNow);
        for (ClpShipment shipment : overdue) {
            if (shipment.getStatus() == ShipmentStatus.DELAYED) continue;
            String oldStatus = shipment.getStatus().name();
            shipment.setStatus(ShipmentStatus.DELAYED);
            shipmentRepo.save(shipment);

            ClpBaggageBatch batch = shipment.getBaggageBatch();
            batch.setStatus(BatchStatus.DELAYED);
            batchRepo.save(batch);

            recordStatusChange(shipment, oldStatus, "DELAYED", null, simNow);
        }
    }

    private void updateAirportOccupancy(LocalDateTime simNow) {
        List<ClpAirport> airports = airportRepo.findAll();

        List<ClpBaggageBatch> waitingBatches = batchRepo.findPendingBatches(simNow);
        List<ClpBaggageBatch> deliveredBatches = batchRepo.findRecentlyDelivered(simNow.minusMinutes(15));

        List<ClpRouteLeg> intermediateLegs = routeLegRepo.findFirstPendingLegsOfTransitBagsAtIntermediateStops();
        Map<Long, Long> intermediateBagsByAirport = intermediateLegs.stream()
                .collect(Collectors.groupingBy(
                        rl -> rl.getFlight().getOriginAirport().getId(),
                        Collectors.summingLong(rl -> rl.getRoute().getShipment().getBaggageBatch().getQuantity())
                ));

        for (ClpAirport airport : airports) {
            long waiting = waitingBatches.stream()
                    .filter(b -> b.getOriginAirport().getId().equals(airport.getId()))
                    .mapToLong(ClpBaggageBatch::getQuantity)
                    .sum();
            long delivered = deliveredBatches.stream()
                    .filter(b -> b.getDestinationAirport().getId().equals(airport.getId()))
                    .mapToLong(ClpBaggageBatch::getQuantity)
                    .sum();
            long intermediate = intermediateBagsByAirport.getOrDefault(airport.getId(), 0L);
            // NOTA: en colapso NO capeamos a warehouse_capacity — dejamos que suba para detectar >100%
            int occupancy = (int) (waiting + delivered + intermediate);
            airport.setCurrentOccupancy(occupancy);
        }
        airportRepo.saveAll(airports);
    }

    private ClpKpiSnapshot persistKpi(ClpSimulation sim, LocalDateTime simNow) {
        long total = shipmentRepo.countTotal();
        long delivered = shipmentRepo.countDelivered();
        long onTime = shipmentRepo.countOnTimeDeliveries();
        long delayed = shipmentRepo.countByStatus(ShipmentStatus.DELAYED);

        double onTimePct = total > 0 ? (double) onTime / total * 100.0 : 100.0;

        List<ClpFlight> inFlight = flightRepo.findByStatus(FlightStatus.IN_FLIGHT);
        double avgFlightOcc = inFlight.isEmpty() ? 0.0 :
                inFlight.stream()
                        .mapToDouble(f -> f.getBaggageCapacity() > 0
                                ? (double) f.getCurrentLoad() / f.getBaggageCapacity() * 100.0
                                : 0.0)
                        .average().orElse(0.0);

        List<ClpAirport> airports = airportRepo.findAll();
        double avgWarehouseOcc = airports.isEmpty() ? 0.0 :
                airports.stream().mapToDouble(ClpAirport::getOccupancyPct).average().orElse(0.0);

        ClpKpiSnapshot snapshot = new ClpKpiSnapshot();
        snapshot.setSimulation(sim);
        snapshot.setSnapshotTime(simNow);
        snapshot.setOnTimePct(BigDecimal.valueOf(onTimePct).setScale(2, RoundingMode.HALF_UP));
        snapshot.setDelayedCount((int) delayed);
        snapshot.setAvgFlightOccupancy(BigDecimal.valueOf(avgFlightOcc).setScale(2, RoundingMode.HALF_UP));
        snapshot.setAvgWarehouseOccupancy(BigDecimal.valueOf(avgWarehouseOcc).setScale(2, RoundingMode.HALF_UP));

        return kpiSnapshotRepo.save(snapshot);
    }

    private void publishTick(ClpSimulation sim, LocalDateTime simNow, SimulationClock clock,
                              ClpKpiSnapshot kpi, long elapsedSec) {
        List<ClpAirport> airports = airportRepo.findAll();
        List<ClpFlight> activeFlights = flightRepo.findAssignedFlightsForTick(
                simNow.plusHours(24), simNow.minusHours(1));

        List<SimulationTickEvent.AirportPayload> airportPayloads = airports.stream()
                .map(a -> {
                    double pct = a.getOccupancyPct();
                    return SimulationTickEvent.AirportPayload.builder()
                            .iata(a.getIataCode())
                            .occupancyPct(pct)
                            .semaphoreLevel(airportService.getSemaphoreLevel(pct, thresholdAmber, thresholdRed).name())
                            .currentOccupancy(a.getCurrentOccupancy())
                            .build();
                }).collect(Collectors.toList());

        List<SimulationTickEvent.FlightPayload> flightPayloads = activeFlights.stream()
                .filter(f -> f.getStatus() != FlightStatus.LANDED)
                .map(f -> SimulationTickEvent.FlightPayload.builder()
                        .flightId(f.getId())
                        .originIata(f.getOriginAirport().getIataCode())
                        .destinationIata(f.getDestinationAirport().getIataCode())
                        .progress(f.getProgress(simNow))
                        .status(f.getStatus().name())
                        .baggageCapacity(f.getBaggageCapacity())
                        .currentLoad(f.getCurrentLoad())
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

        Map<String, Long> shipmentCounts = new HashMap<>();
        for (BatchStatus bs : BatchStatus.values()) {
            shipmentCounts.put(bs.name(), batchRepo.countByStatus(bs));
        }

        SimulationTickEvent event = SimulationTickEvent.builder()
                .simulationId(sim.getId())
                .simulationStatus(sim.getStatus().name())
                .simulatedDay(clock.getSimulatedDay())
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
    }

    private void recordStatusChange(ClpShipment shipment, String oldStatus, String newStatus,
                                     ClpAirport airport, LocalDateTime changedAt) {
        statusHistoryRepo.save(new ClpShipmentStatusHistory(
                shipment, oldStatus, newStatus, airport, changedAt));
    }

    public void removeState(Long simulationId) {
        runtimeStates.remove(simulationId);
    }

    static class ClpRuntimeState {
        final SimulationClock clock;
        final long startMillis;
        final Random rng;

        ClpRuntimeState(SimulationClock clock, long startMillis, Random rng) {
            this.clock = clock;
            this.startMillis = startMillis;
            this.rng = rng;
        }

        long elapsedRealSeconds() {
            return (System.currentTimeMillis() - startMillis) / 1000;
        }
    }
}
