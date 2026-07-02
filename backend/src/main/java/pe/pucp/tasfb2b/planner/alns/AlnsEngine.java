package pe.pucp.tasfb2b.planner.alns;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Route;
import pe.pucp.tasfb2b.domain.RouteLeg;
import pe.pucp.tasfb2b.domain.Shipment;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.planner.OptimizationResult;
import pe.pucp.tasfb2b.planner.RouteOptimizer;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.destroy.DestroyOperator;
import pe.pucp.tasfb2b.planner.alns.destroy.RelatedRemoval;
import pe.pucp.tasfb2b.planner.alns.destroy.RouteRemoval;
import pe.pucp.tasfb2b.planner.alns.destroy.WorstRemoval;
import pe.pucp.tasfb2b.planner.alns.repair.RegretKInsertion;
import pe.pucp.tasfb2b.planner.alns.repair.RepairOperator;

import pe.pucp.tasfb2b.planner.PlanProgressSnapshot;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Component
@Slf4j
public class AlnsEngine implements RouteOptimizer {

    @Override
    public OptimizationResult optimize(SimulationContext context) {
        Instant start = Instant.now();
        AlnsParams p = context.getAlnsParams();
        Random rng = new Random(42L);

        List<BaggageBatch> batches = context.getPendingBatches();
        List<Flight> flights = context.getFlights().stream()
                .filter(f -> f.getStatus() == FlightStatus.SCHEDULED)
                .collect(Collectors.toList());

        if (batches.isEmpty()) {
            return new OptimizationResult(Collections.emptyList(), 0, 0,
                    Duration.ZERO, 0.0);
        }

        Consumer<PlanProgressSnapshot> callback = context.getProgressCallback();

        AlnsSolution current = buildGreedyInit(batches, flights, p);
        AlnsSolution best = current.deepCopy();
        double bestObj = evaluate(best, p);
        double currentObj = bestObj;
        double T = p.t0();

        if (callback != null) {
            callback.accept(new PlanProgressSnapshot(
                    "GREEDY_INIT", 0, p.maxIterations(),
                    best.getAssignments().size(), batches.size(), bestObj,
                    0, 0, "", ""));
        }

        List<DestroyOperator> destroyOps = List.of(
                new RouteRemoval(),
                new RelatedRemoval(),
                new WorstRemoval(p.pNoise())
        );
        RepairOperator repairOp = new RegretKInsertion(p.connectMinGapMinutes(), p.maxHops());

        double[] dWeights = {1.0, 1.0, 1.0};
        double[] dScores = {0.0, 0.0, 0.0};
        int[] dUses = {0, 0, 0};

        // Snapshot of the last accepted state — restored on rejection instead of deepCopy per iter.
        AlnsSolution.Snapshot currentSnap = current.snapshot();
        double bestObjAtSegStart = bestObj;
        int stagnantSegments = 0;
        final int MAX_STAGNANT_SEGMENTS = 3; // stop if bestObj unchanged for 3 consecutive segments

        for (int iter = 0; iter < p.maxIterations(); iter++) {
            int q = Math.max(1, (int) Math.ceil(p.qPct() * batches.size()));

            int dIdx = selectByRoulette(dWeights, rng);
            // Mutate current in-place; restore from snapshot if rejected.
            destroyOps.get(dIdx).destroy(current, batches, q, rng);
            repairOp.repair(current, batches, flights, p.kRegret(), rng);

            double candidateObj = evaluate(current, p);
            double delta = candidateObj - currentObj;

            boolean accepted = delta <= 0 || rng.nextDouble() < Math.exp(-delta / T);

            if (accepted) {
                currentObj = candidateObj;
                currentSnap = current.snapshot(); // new rollback baseline

                if (candidateObj < bestObj) {
                    best = current.deepCopy(); // deepCopy only when actually improving best
                    bestObj = candidateObj;
                    dScores[dIdx] += p.sigma1();
                } else {
                    dScores[dIdx] += p.sigma2();
                }
            } else {
                current.restore(currentSnap); // rollback without rebuilding flightMap/batchMap
                dScores[dIdx] += p.sigma3();
            }
            dUses[dIdx]++;

            T *= p.alpha();

            if ((iter + 1) % p.segLen() == 0) {
                updateWeights(dWeights, dScores, dUses, p.rho());
                Arrays.fill(dScores, 0.0);
                Arrays.fill(dUses, 0);

                if (callback != null) {
                    callback.accept(new PlanProgressSnapshot(
                            "OPTIMIZING", iter + 1, p.maxIterations(),
                            best.getAssignments().size(), batches.size(), bestObj,
                            0, 0, "", ""));
                }

                // Early termination: stop if best objective hasn't improved across MAX_STAGNANT_SEGMENTS
                if (bestObj >= bestObjAtSegStart) {
                    stagnantSegments++;
                    if (stagnantSegments >= MAX_STAGNANT_SEGMENTS) {
                        log.debug("ALNS terminación anticipada en iter {} — {} segmentos sin mejora", iter + 1, stagnantSegments);
                        break;
                    }
                } else {
                    stagnantSegments = 0;
                }
                bestObjAtSegStart = bestObj;
            }
        }

        if (callback != null) {
            callback.accept(new PlanProgressSnapshot(
                    "COMPLETE", p.maxIterations(), p.maxIterations(),
                    best.getAssignments().size(), batches.size(), bestObj,
                    0, 0, "", ""));
        }

        Duration elapsed = Duration.between(start, Instant.now());
        List<Route> routes = buildRoutes(best, batches, flights, context.getSimulatedNow(), "ALNS");

        int assigned = best.getAssignments().size();
        int failed = best.getBankSize();

        log.info("ALNS completado: asignados={}, fallidos={}, obj={}, tiempo={}ms",
                assigned, failed, String.format("%.4f", bestObj), elapsed.toMillis());

        return new OptimizationResult(routes, assigned, failed, elapsed, bestObj);
    }

    @Override
    public OptimizationResult replan(List<BaggageBatch> affected, SimulationContext context) {
        log.info("ALNS replanificando {} lotes afectados", affected.size());
        AlnsParams p = context.getAlnsParams();
        Random rng = new Random(99L);

        List<Flight> flights = context.getFlights().stream()
                .filter(f -> f.getStatus() == FlightStatus.SCHEDULED)
                .collect(Collectors.toList());

        AlnsSolution solution = new AlnsSolution(flights, affected);
        RepairOperator repair = new RegretKInsertion(p.connectMinGapMinutes(), p.maxHops());
        repair.repair(solution, affected, flights, p.kRegret(), rng);

        Instant start = Instant.now();
        List<Route> routes = buildRoutes(solution, affected, flights, context.getSimulatedNow(), "ALNS");
        Duration elapsed = Duration.between(start, Instant.now());

        return new OptimizationResult(routes, solution.getAssignments().size(),
                solution.getBankSize(), elapsed, evaluate(solution, p));
    }

    @Override
    public String algorithmName() {
        return "ALNS";
    }

    private AlnsSolution buildGreedyInit(List<BaggageBatch> batches, List<Flight> flights,
                                          AlnsParams p) {
        AlnsSolution solution = new AlnsSolution(flights, batches);

        Map<String, List<Flight>> flightsByOrigin = flights.stream()
                .collect(Collectors.groupingBy(f -> f.getOriginAirport().getIataCode()));

        List<BaggageBatch> sorted = batches.stream()
                .sorted(Comparator.comparing(BaggageBatch::getAvailableFrom))
                .collect(Collectors.toList());

        for (BaggageBatch batch : sorted) {
            String origin = batch.getOriginAirport().getIataCode();
            String dest = batch.getDestinationAirport().getIataCode();
            int qty = batch.getQuantity();

            Optional<Flight> directFlight = flightsByOrigin.getOrDefault(origin, Collections.emptyList())
                    .stream()
                    .filter(f -> f.getDestinationAirport().getIataCode().equals(dest))
                    .filter(f -> !f.getDepartureTime().isBefore(batch.getAvailableFrom()))
                    .filter(f -> solution.canAssign(f.getId(), qty))
                    .min(Comparator.comparing(Flight::getDepartureTime));

            if (directFlight.isPresent()) {
                solution.assign(batch.getId(), List.of(directFlight.get().getId()));
                continue;
            }

            // Fallback: find best 2-hop connection (earliest arrival at destination)
            Flight bestF1 = null;
            Flight bestF2 = null;
            for (Flight f1 : flightsByOrigin.getOrDefault(origin, Collections.emptyList())) {
                if (f1.getDepartureTime().isBefore(batch.getAvailableFrom())) continue;
                if (!solution.canAssign(f1.getId(), qty)) continue;
                String hub = f1.getDestinationAirport().getIataCode();
                if (hub.equals(dest)) continue;
                for (Flight f2 : flightsByOrigin.getOrDefault(hub, Collections.emptyList())) {
                    if (!f2.getDestinationAirport().getIataCode().equals(dest)) continue;
                    if (!solution.canAssign(f2.getId(), qty)) continue;
                    long gap = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                    if (gap < p.connectMinGapMinutes()) continue;
                    if (bestF2 == null || f2.getArrivalTime().isBefore(bestF2.getArrivalTime())) {
                        bestF1 = f1;
                        bestF2 = f2;
                    }
                }
            }
            if (bestF1 != null) {
                solution.assign(batch.getId(), List.of(bestF1.getId(), bestF2.getId()));
                continue;
            }

            // Segundo fallback: mejor conexión de 2 escalas (3 tramos). Solo se intenta si no
            // hubo directo ni 1 escala — cubre origen-destino que antes quedaban atrapados sin
            // candidato posible (ver RegretKInsertion, misma lógica). buildGreedyInit solo da
            // el punto de partida; el repair operator la sigue puliendo en cada iteración.
            if (p.maxHops() >= 3) {
                Flight bF1 = null, bF2 = null, bF3 = null;
                for (Flight f1 : flightsByOrigin.getOrDefault(origin, Collections.emptyList())) {
                    if (f1.getDepartureTime().isBefore(batch.getAvailableFrom())) continue;
                    if (!solution.canAssign(f1.getId(), qty)) continue;
                    String hub1 = f1.getDestinationAirport().getIataCode();
                    if (hub1.equals(dest) || hub1.equals(origin)) continue;

                    for (Flight f2 : flightsByOrigin.getOrDefault(hub1, Collections.emptyList())) {
                        String hub2 = f2.getDestinationAirport().getIataCode();
                        if (hub2.equals(origin) || hub2.equals(hub1)) continue;
                        if (!solution.canAssign(f2.getId(), qty)) continue;
                        long gap1 = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                        if (gap1 < p.connectMinGapMinutes()) continue;

                        for (Flight f3 : flightsByOrigin.getOrDefault(hub2, Collections.emptyList())) {
                            if (!f3.getDestinationAirport().getIataCode().equals(dest)) continue;
                            if (!solution.canAssign(f3.getId(), qty)) continue;
                            long gap2 = Duration.between(f2.getArrivalTime(), f3.getDepartureTime()).toMinutes();
                            if (gap2 < p.connectMinGapMinutes()) continue;
                            if (bF3 == null || f3.getArrivalTime().isBefore(bF3.getArrivalTime())) {
                                bF1 = f1;
                                bF2 = f2;
                                bF3 = f3;
                            }
                        }
                    }
                }
                if (bF1 != null) {
                    solution.assign(batch.getId(), List.of(bF1.getId(), bF2.getId(), bF3.getId()));
                }
            }
        }

        return solution;
    }

    private double evaluate(AlnsSolution solution, AlnsParams p) {
        int total = solution.getBatchMap().size();
        if (total == 0) return 0.0;

        int unassigned = solution.getBankSize();
        double comp1 = p.w1() * ((double) unassigned / total);

        double totalCapacity = 0;
        double totalOverload = 0;
        double usedCapacityWithLoad = 0;
        double actualLoadWithLoad = 0;
        for (Flight f : solution.getFlightMap().values()) {
            int extra = solution.getExtraLoad().getOrDefault(f.getId(), 0);
            int used = f.getCurrentLoad() + extra;
            totalCapacity += f.getBaggageCapacity();
            if (used > f.getBaggageCapacity()) totalOverload += used - f.getBaggageCapacity();
            if (used > 0) {
                usedCapacityWithLoad += f.getBaggageCapacity();
                actualLoadWithLoad += used;
            }
        }
        double comp2 = totalCapacity > 0 ? p.w2() * (totalOverload / totalCapacity) : 0.0;

        // Penalize low utilization on flights that carry any load (incentivizes consolidation)
        double comp4 = 0.0;
        if (usedCapacityWithLoad > 0) {
            double avgUtil = actualLoadWithLoad / usedCapacityWithLoad;
            comp4 = p.w4() * (1.0 - avgUtil);
        }

        int assigned = total - unassigned;
        if (assigned == 0) return comp1 + comp2 + comp4;

        double totalWait = 0;
        double totalLateFraction = 0;
        for (Long batchId : solution.getAssignments().keySet()) {
            totalWait += solution.getWaitingMinutes(batchId);
            // Minutos de atraso normalizados a "días de atraso" y acotados a 1.0 (1 día tarde
            // ya pesa lo máximo posible; no queremos que un atraso de 5 días opaque en la suma
            // a diez lotes con 1 minuto de atraso cada uno).
            long lateMin = solution.getLatenessMinutes(batchId);
            if (lateMin > 0) {
                totalLateFraction += Math.min(1.0, lateMin / 1440.0);
            }
        }
        double comp3 = p.w3() * (totalWait / ((double) assigned * 1440.0));

        // comp5: fracción (0..1) de lotes asignados que van a llegar tarde, ponderada por
        // cuán tarde llegan. Este componente NO EXISTÍA antes — es la pieza que faltaba para
        // que el ALNS "sepa" que el SLA (1 día mismo continente / 2 días distinto continente)
        // es parte de lo que tiene que optimizar, y no solo un reporte que se calcula después.
        double comp5 = p.w5() * (totalLateFraction / assigned);

        return comp1 + comp2 + comp3 + comp4 + comp5;
    }

    private int selectByRoulette(double[] weights, Random rng) {
        double sum = Arrays.stream(weights).sum();
        double r = rng.nextDouble() * sum;
        double acc = 0;
        for (int i = 0; i < weights.length; i++) {
            acc += weights[i];
            if (r <= acc) return i;
        }
        return weights.length - 1;
    }

    private void updateWeights(double[] weights, double[] scores, int[] uses, double rho) {
        double sum = 0;
        for (int i = 0; i < weights.length; i++) {
            if (uses[i] > 0) {
                weights[i] = (1 - rho) * weights[i] + rho * (scores[i] / uses[i]);
            }
            weights[i] = Math.max(0.01, weights[i]);
            sum += weights[i];
        }
        for (int i = 0; i < weights.length; i++) {
            weights[i] /= sum;
        }
    }

    private List<Route> buildRoutes(AlnsSolution solution, List<BaggageBatch> batches,
                                     List<Flight> flights, LocalDateTime simNow, String algorithm) {
        Map<Long, Flight> flightMap = flights.stream()
                .collect(Collectors.toMap(Flight::getId, f -> f));

        List<Route> routes = new ArrayList<>();
        Map<Long, BaggageBatch> batchById = batches.stream()
                .collect(Collectors.toMap(BaggageBatch::getId, b -> b));

        for (Map.Entry<Long, List<Long>> entry : solution.getAssignments().entrySet()) {
            Long batchId = entry.getKey();
            List<Long> flightIds = entry.getValue();

            BaggageBatch batch = batchById.get(batchId);
            if (batch == null) continue;

            // Build shipment
            Shipment shipment = new Shipment();
            shipment.setBaggageBatch(batch);
            LocalDateTime deadline = computeDeadline(batch, simNow);
            shipment.setDeadline(deadline);

            // Build route
            Route route = new Route();
            route.setShipment(shipment);
            route.setTotalLegs(flightIds.size());
            route.setAlgorithmUsed(algorithm);

            List<RouteLeg> legs = new ArrayList<>();
            LocalDateTime lastArrival = null;
            for (int i = 0; i < flightIds.size(); i++) {
                Flight f = flightMap.get(flightIds.get(i));
                if (f == null) continue;
                RouteLeg leg = new RouteLeg();
                leg.setRoute(route);
                leg.setFlight(f);
                leg.setLegOrder(i + 1);
                legs.add(leg);
                lastArrival = f.getArrivalTime();
            }
            route.setLegs(legs);
            if (lastArrival != null) route.setEstimatedArrival(lastArrival);
            else route.setEstimatedArrival(simNow.plusDays(1));

            routes.add(route);
        }

        return routes;
    }

    private LocalDateTime computeDeadline(BaggageBatch batch, LocalDateTime simNow) {
        // Delegado a DeadlineUtil para que evaluate(), RegretKInsertion.cost() y
        // WorstRemoval.computeCost() usen exactamente la misma regla que se persiste
        // finalmente en el Shipment — una sola fuente de verdad para el deadline SLA.
        return DeadlineUtil.computeDeadline(batch);
    }
}
