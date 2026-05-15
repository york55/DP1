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
import pe.pucp.tasfb2b.planner.OptimizationResult;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.service.AirportService;
import pe.pucp.tasfb2b.service.PlannerService;
import pe.pucp.tasfb2b.websocket.WebSocketEventPublisher;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationEngine {

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

    public void initSimulation(Long simulationId) {
        Simulation sim = simulationRepo.findById(simulationId).orElseThrow();
        LocalDateTime start = sim.getSimulatedTime() != null
                ? sim.getSimulatedTime()
                : sim.getStartDate().atStartOfDay();
        SimulationClock clock = new SimulationClock(start, tickDurationMinutes);
        long startNano = System.currentTimeMillis();
        runtimeStates.put(simulationId, new SimulationRuntimeState(clock, startNano, new Random(sim.getSeed())));
        log.info("Motor de simulación inicializado para simulación {}", simulationId);
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

            SimulationClock clock = state.clock();
            LocalDateTime simNow = clock.advance();

            sim.setSimulatedTime(simNow);
            simulationRepo.save(sim);

            // 1. Land arrived flights
            processArrivals(simNow);

            // 2. Depart scheduled flights
            processDepartures(simNow);

            // 3. Generate cancellations
            processCancellations(sim, state.rng(), simNow, simulationId);

            // 4. Check SLA violations
            checkSlaViolations(simNow);

            // 5. Update airport occupancy
            updateAirportOccupancy(simNow);

            // 6. Persist KPI snapshot
            KpiSnapshot kpi = persistKpi(sim, simNow);

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

    private void processArrivals(LocalDateTime simNow) {
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
    }

    private void processDepartures(LocalDateTime simNow) {
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

                flight.setStatus(FlightStatus.CANCELLED);
                flightRepo.save(flight);

                if (cancellationRepo.existsByFlightId(flight.getId())) {
                    log.debug("Vuelo {} ya tiene cancelación registrada, omitiendo", flight.getId());
                } else {
                    FlightCancellation cancellation = new FlightCancellation(flight, simNow,
                            "Cancelación automática por simulación");
                    cancellationRepo.save(cancellation);
                }

                log.info("Vuelo {} cancelado durante simulación {}", flight.getId(), simulationId);

                // Trigger replanning for affected batches
                if (flight.getId() == null) {
                    log.error("Vuelo {} cancelado no tiene ID persistido. Saltando replanificación.", flight);
                    continue;
                }

                List<RouteLeg> affectedLegs = routeLegRepo
                        .findByFlightIdAndStatus(flight.getId(), RouteLegStatus.PENDING);

                if (!affectedLegs.isEmpty()) {
                    List<BaggageBatch> affectedBatches = affectedLegs.stream()
                            .map(leg -> leg.getRoute().getShipment().getBaggageBatch())
                            .collect(Collectors.toList());

                    for (RouteLeg leg : affectedLegs) {
                        leg.setStatus(RouteLegStatus.CANCELLED);
                        routeLegRepo.save(leg);
                    }

                    try {
                        List<Flight> availableFlights = flightRepo.findByStatus(FlightStatus.SCHEDULED);
                        List<Airport> airports = airportRepo.findAll();

                        SimulationContext ctx = SimulationContext.builder()
                                .airports(airports)
                                .flights(availableFlights)
                                .pendingBatches(affectedBatches)
                                .simulatedNow(simNow)
                                .build();

                        plannerService.replan(affectedBatches, ctx, sim.getAlgorithm());

                        eventPublisher.publishAlert(simulationId,
                                new WebSocketEventPublisher.AlertEvent(
                                        "CANCELLATION", null, flight.getId(), null,
                                        "Vuelo cancelado. Replanificando " + affectedBatches.size() + " lotes.",
                                        simNow.format(TIME_FMT)
                                ));
                    } catch (Exception e) {
                        log.error("Error en replanificación tras cancelación de vuelo {}: {}", flight.getId(), e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.error("Error crítico al procesar cancelación del vuelo {}: {}", flight.getId(), e.getMessage());
            }
        }
    }

    private void checkSlaViolations(LocalDateTime simNow) {
        List<Shipment> overdue = shipmentRepo.findOverdueShipments(simNow);
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
        }
    }

    private static final int DELIVERED_STORAGE_HOURS = 5;

    private void updateAirportOccupancy(LocalDateTime simNow) {
        List<Airport> airports = airportRepo.findAll();

        // Bags waiting at origin (not yet dispatched)
        List<BaggageBatch> waitingBatches = batchRepo.findByStatus(BatchStatus.IN_ORIGIN);

        // Bags that arrived at destination within the last 5 simulated hours
        LocalDateTime deliveryCutoff = simNow.minusHours(DELIVERED_STORAGE_HOURS);
        List<BaggageBatch> recentlyDelivered = batchRepo.findRecentlyDelivered(deliveryCutoff);

        for (Airport airport : airports) {
            long waiting = waitingBatches.stream()
                    .filter(b -> b.getOriginAirport().getId().equals(airport.getId()))
                    .mapToLong(BaggageBatch::getQuantity)
                    .sum();
            long justArrived = recentlyDelivered.stream()
                    .filter(b -> b.getDestinationAirport().getId().equals(airport.getId()))
                    .mapToLong(BaggageBatch::getQuantity)
                    .sum();
            int occupancy = (int) Math.min(waiting + justArrived, airport.getWarehouseCapacity());
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

        List<Flight> inFlight = flightRepo.findByStatus(FlightStatus.IN_FLIGHT);
        double avgFlightOcc = inFlight.isEmpty() ? 0.0 :
                inFlight.stream()
                        .mapToDouble(f -> f.getBaggageCapacity() > 0
                                ? (double) f.getCurrentLoad() / f.getBaggageCapacity() * 100.0
                                : 0.0)
                        .average()
                        .orElse(0.0);

        List<Airport> airports = airportRepo.findAll();
        double avgWarehouseOcc = airports.isEmpty() ? 0.0 :
                airports.stream()
                        .mapToDouble(Airport::getOccupancyPct)
                        .average()
                        .orElse(0.0);

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
        List<Airport> airports = airportRepo.findAll();
        List<Flight> activeFlights = flightRepo.findAssignedFlightsForTick(simNow.plusHours(24));

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
                .map(f -> SimulationTickEvent.FlightPayload.builder()
                        .flightId(f.getId())
                        .originIata(f.getOriginAirport().getIataCode())
                        .destinationIata(f.getDestinationAirport().getIataCode())
                        .progress(f.getProgress(simNow))
                        .status(f.getStatus().name())
                        .baggageCapacity(f.getBaggageCapacity())
                        .currentLoad(f.getCurrentLoad())
                        .build())
                .collect(Collectors.toList());

        long totalBags     = batchRepo.sumAllQuantity();
        long deliveredBags = batchRepo.sumQuantityByStatus(BatchStatus.DELIVERED);
        long inTransitBags = batchRepo.sumQuantityByStatus(BatchStatus.IN_TRANSIT);
        long delayedBags   = batchRepo.sumQuantityByStatus(BatchStatus.DELAYED);
        long waitingBags   = batchRepo.sumQuantityByStatus(BatchStatus.IN_ORIGIN);

        SimulationTickEvent event = SimulationTickEvent.builder()
                .simulationId(sim.getId())
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
                .build();

        eventPublisher.publishTick(sim.getId(), event);
    }

    private void recordStatusChange(Shipment shipment, String oldStatus, String newStatus,
                                     Airport airport, LocalDateTime changedAt) {
        ShipmentStatusHistory history = new ShipmentStatusHistory(
                shipment, oldStatus, newStatus, airport, changedAt);
        statusHistoryRepo.save(history);
    }

    public void removeState(Long simulationId) {
        runtimeStates.remove(simulationId);
    }

    record SimulationRuntimeState(SimulationClock clock, long startMillis, Random rng) {
        long elapsedRealSeconds() {
            return (System.currentTimeMillis() - startMillis) / 1000;
        }
    }
}
