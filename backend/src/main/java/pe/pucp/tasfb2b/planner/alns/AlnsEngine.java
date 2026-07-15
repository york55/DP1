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
                    Duration.ZERO, 0.0, Collections.emptyList());
        }

        Consumer<PlanProgressSnapshot> callback = context.getProgressCallback();

        List<DestroyOperator> destroyOps = List.of(
                new RouteRemoval(),
                new RelatedRemoval(),
                new WorstRemoval(p.pNoise())
        );
        RepairOperator repairOp = new RegretKInsertion(p.connectMinGapMinutes(), p.maxHops());

        // Solución inicial: regret-k insertion sobre solución vacía. Reemplaza al antiguo
        // buildGreedyInit(), que duplicaba (con lógica más débil: elegía el vuelo que salía
        // primero sin mirar el deadline) la misma búsqueda de rutas que el repair operator
        // ya hace mejor — y de paso construye la caché de candidatos que usarán todas las
        // iteraciones siguientes.
        AlnsSolution current = new AlnsSolution(flights, batches);
        repairOp.repair(current, batches, flights, p.kRegret(), rng);
        AlnsSolution best = current.deepCopy();
        double bestObj = evaluate(best, p);
        double currentObj = bestObj;

        // Temperatura inicial CALIBRADA a la escala real del objetivo. La función objetivo
        // es normalizada (típicamente 0.02–1.0), así que con el antiguo T0=100 la
        // probabilidad de aceptar una solución PEOR era exp(-0.01/100) ≈ 0.9999 en todas
        // las iteraciones: el recocido simulado degeneraba en una caminata aleatoria que
        // nunca convergía. Si el llamador pasa un t0 legado (>1.0) se auto-calibra al ~10%
        // del objetivo inicial (acepta deterioros de ese orden con prob. e^-1 al comienzo);
        // valores de t0 <= 1.0 se respetan tal cual.
        double T = p.t0() > 1.0
                ? Math.max(1e-4, 0.10 * Math.max(bestObj, 0.05))
                : p.t0();

        if (callback != null) {
            callback.accept(new PlanProgressSnapshot(
                    "GREEDY_INIT", 0, p.maxIterations(),
                    best.getAssignments().size(), batches.size(), bestObj,
                    0, 0, "", ""));
        }

        double[] dWeights = {1.0, 1.0, 1.0};
        double[] dScores = {0.0, 0.0, 0.0};
        int[] dUses = {0, 0, 0};

        // Snapshot of the last accepted state — restored on rejection instead of deepCopy per iter.
        AlnsSolution.Snapshot currentSnap = current.snapshot();
        double bestObjAtSegStart = bestObj;
        int stagnantSegments = 0;
        final int MAX_STAGNANT_SEGMENTS = 3; // stop if bestObj unchanged for 3 consecutive segments

        // Tope absoluto de destrucción: con miles de lotes por bloque, qPct=0.25 destruiría
        // (y repararía) cientos o miles de lotes POR ITERACIÓN. Movimientos de ~100 lotes
        // son suficientes para que el ALNS explore bien, y mantienen el costo por iteración
        // acotado sin importar el tamaño de la instancia.
        final int qCap = 100;

        for (int iter = 0; iter < p.maxIterations(); iter++) {
            int q = Math.min(qCap, Math.max(1, (int) Math.ceil(p.qPct() * batches.size())));

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

        // Pase final de rescate determinístico: si quedó algún lote tardío o sin asignar,
        // intenta liberarle una ruta puntual eyectando bloqueadores hacia sus alternativas.
        // Garantiza los arreglos "a un intercambio de distancia" que la búsqueda estocástica
        // podría no haber encontrado.
        int rescued = repairOp.rescue(best);
        if (rescued > 0) {
            bestObj = evaluate(best, p);
            log.info("Rescate por eyección: {} lotes recuperados a rutas puntuales, obj={}",
                    rescued, String.format("%.4f", bestObj));
        }

        List<Route> routes = buildRoutes(best, batches, flights, context.getSimulatedNow(), "ALNS");

        int assigned = best.getAssignments().size();
        int failed = best.getBankSize();

        log.info("ALNS completado: asignados={}, fallidos={}, obj={}, tiempo={}ms",
                assigned, failed, String.format("%.4f", bestObj), elapsed.toMillis());

        return new OptimizationResult(routes, assigned, failed, elapsed, bestObj,
                new ArrayList<>(best.getBank()));
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
        repair.rescue(solution);

        Instant start = Instant.now();
        List<Route> routes = buildRoutes(solution, affected, flights, context.getSimulatedNow(), "ALNS");
        Duration elapsed = Duration.between(start, Instant.now());

        return new OptimizationResult(routes, solution.getAssignments().size(),
                solution.getBankSize(), elapsed, evaluate(solution, p),
                new ArrayList<>(solution.getBank()));
    }

    @Override
    public String algorithmName() {
        return "ALNS";
    }

    // ── Escala de penalizaciones NO DILUIDAS (por lote, sin dividir por el total) ──
    // Con la regla "1 retraso = colapso", un solo lote tardío debe pesar más que CUALQUIER
    // mejora posible de espera/utilización. Antes comp1 y comp5 se normalizaban por el
    // total de lotes: con ~3500 envíos en almacén, un lote tardío sumaba
    // 0.35 × 1/3500 ≈ 0.0001 al objetivo — menos que el ruido del componente de espera —
    // así que el recocido podía aceptar (y elegir como "best") una solución que sacrificaba
    // un envío haciéndolo tardío a cambio de reducir un poco la espera global. Ese es
    // exactamente el mecanismo detrás de "1 retraso al día 3.5 con 3559 envíos en almacén".
    // Jerarquía estricta: SIN ASIGNAR (nunca sale del almacén) > TARDÍO > tiempo en tierra.
    private static final double UNASSIGNED_PENALTY_PER_BATCH = 2.0;
    private static final double LATE_PENALTY_PER_BATCH = 1.0;

    private double evaluate(AlnsSolution solution, AlnsParams p) {
        int total = solution.getBatchMap().size();
        if (total == 0) return 0.0;

        int unassigned = solution.getBankSize();
        double comp1 = UNASSIGNED_PENALTY_PER_BATCH * unassigned;

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
        double comp5 = 0.0;
        for (Long batchId : solution.getAssignments().keySet()) {
            // Tiempo en tierra TOTAL (espera en origen + layovers en hubs). Cada minuto en
            // tierra son maletas ocupando un almacén — la variable que dispara el colapso
            // por ocupación >100% — así que el objetivo ahora lo ve completo, no solo la
            // espera antes del primer embarque.
            totalWait += solution.getGroundMinutes(batchId);
            // Cada lote tardío suma una penalización FIJA grande más un término acotado por
            // cuán tarde llega (1 día tarde ya pesa lo máximo). Sin dividir por assigned:
            // 1 tardío ≈ 1.0–1.35 en un objetivo que sin tardíos vale ~0.05, así que la
            // búsqueda siempre prefiere eliminar el retraso antes que cualquier otra mejora,
            // y 2 tardíos siempre es peor que 1.
            long lateMin = solution.getLatenessMinutes(batchId);
            if (lateMin > 0) {
                comp5 += LATE_PENALTY_PER_BATCH + p.w5() * Math.min(1.0, lateMin / 1440.0);
            }
        }
        double comp3 = p.w3() * (totalWait / ((double) assigned * 1440.0));

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