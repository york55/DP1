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
import java.time.temporal.ChronoUnit;
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
                    best.getAssignments().size(), batches.size(), bestObj));
        }

        List<DestroyOperator> destroyOps = List.of(
                new RouteRemoval(),
                new RelatedRemoval(),
                new WorstRemoval(p.pNoise())
        );
        RepairOperator repairOp = new RegretKInsertion();

        double[] dWeights = {1.0, 1.0, 1.0};
        double[] dScores = {0.0, 0.0, 0.0};
        int[] dUses = {0, 0, 0};

        for (int iter = 0; iter < p.maxIterations(); iter++) {
            AlnsSolution candidate = current.deepCopy();

            int q = Math.max(1, (int) Math.ceil(p.qPct() * batches.size()));

            int dIdx = selectByRoulette(dWeights, rng);
            destroyOps.get(dIdx).destroy(candidate, batches, q, rng);
            repairOp.repair(candidate, batches, flights, p.kRegret(), rng);

            double candidateObj = evaluate(candidate, p);
            double delta = candidateObj - currentObj;

            boolean accepted = false;
            if (delta <= 0) {
                accepted = true;
            } else {
                double prob = Math.exp(-delta / T);
                if (rng.nextDouble() < prob) accepted = true;
            }

            if (accepted) {
                current = candidate;
                currentObj = candidateObj;

                if (candidateObj < bestObj) {
                    best = candidate.deepCopy();
                    bestObj = candidateObj;
                    dScores[dIdx] += p.sigma1();
                } else {
                    dScores[dIdx] += p.sigma2();
                }
            } else {
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
                            best.getAssignments().size(), batches.size(), bestObj));
                }
            }
        }

        if (callback != null) {
            callback.accept(new PlanProgressSnapshot(
                    "COMPLETE", p.maxIterations(), p.maxIterations(),
                    best.getAssignments().size(), batches.size(), bestObj));
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
        RepairOperator repair = new RegretKInsertion();
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

            Optional<Flight> bestFlight = flightsByOrigin.getOrDefault(origin, Collections.emptyList())
                    .stream()
                    .filter(f -> f.getDestinationAirport().getIataCode().equals(dest))
                    .filter(f -> !f.getDepartureTime().isBefore(batch.getAvailableFrom()))
                    .filter(f -> solution.canAssign(f.getId(), batch.getQuantity()))
                    .min(Comparator.comparing(Flight::getDepartureTime));

            if (bestFlight.isPresent()) {
                solution.assign(batch.getId(), List.of(bestFlight.get().getId()));
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
        for (Flight f : solution.getFlightMap().values()) {
            int used = f.getCurrentLoad() + solution.getExtraLoad().getOrDefault(f.getId(), 0);
            totalCapacity += f.getBaggageCapacity();
            if (used > f.getBaggageCapacity()) totalOverload += used - f.getBaggageCapacity();
        }
        double comp2 = totalCapacity > 0 ? p.w2() * (totalOverload / totalCapacity) : 0.0;

        int assigned = total - unassigned;
        if (assigned == 0) return comp1 + comp2;

        double totalWait = 0;
        for (Long batchId : solution.getAssignments().keySet()) {
            totalWait += solution.getWaitingMinutes(batchId);
        }
        double comp3 = p.w3() * (totalWait / ((double) assigned * 1440.0));

        return comp1 + comp2 + comp3;
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
        boolean sameContinent = batch.isSameContinent();
        int days = sameContinent ? 1 : 2;
        return batch.getAvailableFrom().plus(days, ChronoUnit.DAYS);
    }
}
