package pe.pucp.tasfb2b.planner;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Motor ALNS para el módulo de operaciones reales.
 * Trabaja exclusivamente con OpsShipment y OpsFlight.
 * No tiene ninguna dependencia con el módulo de simulación.
 */
@Component
@Slf4j
public class OpsAlnsEngine {

    /** Minutos mínimos reales de escala en un aeropuerto para habilitar la conexión al siguiente vuelo. */
    private static final int CONNECT_MIN_GAP_MINUTES = 10;

    /** Penalización fija por cada envío que llega después de su deadline (SLA), igual que AlnsEngine (simulación). */
    private static final double LATE_PENALTY_PER_SHIPMENT = 1.0;

    /**
     * Ejecuta el ALNS completo y devuelve las rutas a persistir.
     *
     * @param shipments envíos en estado PENDING
     * @param flights   instancias OpsFlight generadas para la ventana de planificación
     * @param params    parámetros del algoritmo
     * @return lista de OpsShipmentRoute sin id (sin persistir aún)
     */
    public List<OpsShipmentRoute> optimize(List<OpsShipment> shipments,
                                            List<OpsFlight> flights,
                                            AlnsParams params) {
        Instant start = Instant.now();
        Random rng = new Random(42L);

        if (shipments.isEmpty()) {
            log.info("OpsAlns: sin envíos pendientes, nada que planificar.");
            return Collections.emptyList();
        }

        // Solución inicial greedy
        OpsAlnsSolution current = buildGreedyInit(shipments, flights);
        OpsAlnsSolution best    = current.deepCopy();
        double bestObj          = evaluate(best, params);
        double currentObj       = bestObj;
        // Misma calibración que AlnsEngine: el objetivo es normalizado (~0..1), un T0=100
        // legado aceptaba prácticamente cualquier deterioro y el SA no convergía.
        double T = params.t0() > 1.0
                ? Math.max(1e-4, 0.10 * Math.max(bestObj, 0.05))
                : params.t0();

        // Pesos de los 3 operadores de destrucción
        double[] dWeights = {1.0, 1.0, 1.0};
        double[] dScores  = {0.0, 0.0, 0.0};
        int[]    dUses    = {0,   0,   0};

        for (int iter = 0; iter < params.maxIterations(); iter++) {
            OpsAlnsSolution candidate = current.deepCopy();

            int q = Math.max(1, (int) Math.ceil(params.qPct() * shipments.size()));
            int dIdx = selectByRoulette(dWeights, rng);

            // Destroy
            switch (dIdx) {
                case 0 -> routeRemoval(candidate, q, rng);
                case 1 -> relatedRemoval(candidate, q, rng);
                default -> worstRemoval(candidate, q, rng, params.pNoise());
            }

            // Repair
            regretKInsertion(candidate, flights, params.kRegret());

            double candidateObj = evaluate(candidate, params);
            double delta = candidateObj - currentObj;

            boolean accepted = delta <= 0 || rng.nextDouble() < Math.exp(-delta / T);

            if (accepted) {
                current   = candidate;
                currentObj = candidateObj;
                if (candidateObj < bestObj) {
                    best    = candidate.deepCopy();
                    bestObj = candidateObj;
                    dScores[dIdx] += params.sigma1();
                } else {
                    dScores[dIdx] += params.sigma2();
                }
            } else {
                dScores[dIdx] += params.sigma3();
            }
            dUses[dIdx]++;
            T *= params.alpha();

            if ((iter + 1) % params.segLen() == 0) {
                updateWeights(dWeights, dScores, dUses, params.rho());
                Arrays.fill(dScores, 0.0);
                Arrays.fill(dUses, 0);
            }
        }

        Duration elapsed = Duration.between(start, Instant.now());
        log.info("OpsAlns completado: asignados={}, sin_asignar={}, obj={}, tiempo={}ms",
                best.getAssignments().size(), best.getBankSize(),
                String.format("%.4f", bestObj), elapsed.toMillis());

        return buildRoutes(best);
    }

    // ── Inicialización greedy ─────────────────────────────────────────────────

    private OpsAlnsSolution buildGreedyInit(List<OpsShipment> shipments,
                                             List<OpsFlight> flights) {
        OpsAlnsSolution sol = new OpsAlnsSolution(flights, shipments);

        Map<String, List<OpsFlight>> byOrigin = flights.stream()
                .collect(Collectors.groupingBy(OpsFlight::getOriginIata));

        shipments.stream()
                .sorted(Comparator.comparing(OpsShipment::getRegisteredAt))
                .forEach(s -> {
                    // Si el envío ya completó tramos (current_iata seteado tras un
                    // aterrizaje o una cancelación con reubicación), parte desde ahí
                    // en vez del origen original — ver Problema 2c del diagnóstico.
                    String origin = s.getCurrentIata() != null ? s.getCurrentIata() : s.getOriginIata();
                    String dest   = s.getDestIata();
                    byOrigin.getOrDefault(origin, List.of()).stream()
                            .filter(f -> dest.equals(f.getDestIata()))
                            .filter(f -> !f.getDepTimeUtc().isBefore(s.getRegisteredAt()))
                            .filter(f -> sol.canAssign(f.getId(), s.getBagCount()))
                            .min(Comparator.comparing(OpsFlight::getDepTimeUtc))
                            .ifPresent(f -> sol.assign(s.getId(), List.of(f.getId())));
                });

        return sol;
    }

    // ── Función objetivo (minimizar) ──────────────────────────────────────────

    private double evaluate(OpsAlnsSolution sol, AlnsParams p) {
        int total = sol.getShipmentMap().size();
        if (total == 0) return 0.0;

        // w1: fracción sin asignar
        double comp1 = p.w1() * ((double) sol.getBankSize() / total);

        // w2: sobrecarga de capacidad en vuelos
        double totalCap = 0, totalOverload = 0;
        for (OpsFlight f : sol.getFlightMap().values()) {
            int extra = sol.getExtraLoad().getOrDefault(f.getId(), 0);
            totalCap += f.getCapacity();
            if (extra > f.getCapacity()) totalOverload += extra - f.getCapacity();
        }
        double comp2 = totalCap > 0 ? p.w2() * (totalOverload / totalCap) : 0.0;

        // w3: tiempo de espera promedio normalizado a 1440 min
        int assigned = total - sol.getBankSize();
        double comp3 = 0.0;
        if (assigned > 0) {
            double totalWait = sol.getAssignments().keySet().stream()
                    .mapToLong(sol::waitingMinutes).sum();
            comp3 = p.w3() * (totalWait / ((double) assigned * 1440.0));
        }

        // w5: penalización por incumplimiento de SLA (deadline). Cada envío tardío
        // suma una penalización fija grande más un término acotado por cuán tarde
        // llega, para que el algoritmo siempre prefiera eliminar el retraso antes
        // que cualquier otra mejora marginal (mismo criterio que AlnsEngine de
        // simulación).
        double comp5 = 0.0;
        for (Long shipmentId : sol.getAssignedIds()) {
            long lateMin = sol.lateMinutes(shipmentId);
            if (lateMin > 0) {
                comp5 += LATE_PENALTY_PER_SHIPMENT + p.w5() * Math.min(1.0, lateMin / 1440.0);
            }
        }

        return comp1 + comp2 + comp3 + comp5;
    }

    // ── Operadores de destrucción ─────────────────────────────────────────────

    /** Remueve todos los envíos de un vuelo elegido al azar. */
    private void routeRemoval(OpsAlnsSolution sol, int q, Random rng) {
        Set<Long> usedFlights = new HashSet<>();
        sol.getAssignments().values().forEach(usedFlights::addAll);
        if (usedFlights.isEmpty()) return;
        Long targetFlight = usedFlights.stream().skip(rng.nextInt(usedFlights.size())).findFirst().orElse(null);
        if (targetFlight == null) return;
        new ArrayList<>(sol.getAssignments().entrySet()).stream()
                .filter(e -> e.getValue().contains(targetFlight))
                .map(Map.Entry::getKey)
                .limit(q)
                .forEach(sol::unassign);
    }

    /** Remueve envíos con el mismo origen o destino que uno elegido al azar. */
    private void relatedRemoval(OpsAlnsSolution sol, int q, Random rng) {
        List<Long> assigned = sol.getAssignedIds();
        if (assigned.isEmpty()) return;
        Long pivot = assigned.get(rng.nextInt(assigned.size()));
        OpsShipment ps = sol.getShipmentMap().get(pivot);
        if (ps == null) return;
        sol.unassign(pivot);
        sol.getAssignedIds().stream()
                .filter(id -> {
                    OpsShipment s = sol.getShipmentMap().get(id);
                    return s != null && (ps.getOriginIata().equals(s.getOriginIata())
                                     || ps.getDestIata().equals(s.getDestIata()));
                })
                .limit(q - 1)
                .forEach(sol::unassign);
    }

    /** Remueve los envíos con mayor tiempo de espera. */
    private void worstRemoval(OpsAlnsSolution sol, int q, Random rng, double pNoise) {
        sol.getAssignedIds().stream()
                .sorted(Comparator.comparingLong((Long id) -> sol.waitingMinutes(id)).reversed())
                .filter(id -> rng.nextDouble() >= pNoise)
                .limit(q)
                .collect(Collectors.toList())
                .forEach(sol::unassign);
    }

    // ── Operador de reparación: Regret-K Insertion ────────────────────────────

    private void regretKInsertion(OpsAlnsSolution sol, List<OpsFlight> flights, int k) {
        Map<String, List<OpsFlight>> byOrigin = flights.stream()
                .collect(Collectors.groupingBy(OpsFlight::getOriginIata));

        Set<Long> remaining = new LinkedHashSet<>(sol.getBank());

        while (!remaining.isEmpty()) {
            Long bestId    = null;
            double bestReg = Double.NEGATIVE_INFINITY;
            List<Long> bestSeq = null;

            for (Long sid : remaining) {
                OpsShipment s = sol.getShipmentMap().get(sid);
                if (s == null) continue;

                List<List<Long>> candidates = findCandidates(s, byOrigin, sol);

                double regret;
                List<Long> chosen;
                if (candidates.isEmpty()) {
                    regret = Double.MAX_VALUE; chosen = null;
                } else if (candidates.size() == 1) {
                    regret = insertionCost(candidates.get(0), s, sol) + 10000.0;
                    chosen = candidates.get(0);
                } else {
                    double c0 = insertionCost(candidates.get(0), s, sol);
                    double ck = insertionCost(candidates.get(Math.min(k - 1, candidates.size() - 1)), s, sol);
                    regret = ck - c0;
                    chosen = candidates.get(0);
                }

                if (regret > bestReg) {
                    bestReg = regret; bestId = sid; bestSeq = chosen;
                }
            }

            if (bestId == null) break;
            if (bestSeq != null) sol.assign(bestId, bestSeq);
            remaining.remove(bestId);
        }
    }

    private List<List<Long>> findCandidates(OpsShipment s,
                                              Map<String, List<OpsFlight>> byOrigin,
                                              OpsAlnsSolution sol) {
        // Idem buildGreedyInit: parte de la ubicación física actual si el envío
        // ya avanzó tramos; si nunca voló ninguno, current_iata es NULL y cae
        // al comportamiento de siempre (originIata).
        String origin = s.getCurrentIata() != null ? s.getCurrentIata() : s.getOriginIata();
        String dest   = s.getDestIata();
        int    qty    = s.getBagCount();
        List<List<Long>> candidates = new ArrayList<>();

        List<OpsFlight> fromOrigin = byOrigin.getOrDefault(origin, List.of());

        // Vuelos directos
        fromOrigin.stream()
                .filter(f -> dest.equals(f.getDestIata()))
                .filter(f -> !f.getDepTimeUtc().isBefore(s.getRegisteredAt()))
                .filter(f -> sol.canAssign(f.getId(), qty))
                .forEach(f -> candidates.add(List.of(f.getId())));

        // Conexiones de 2 tramos
        for (OpsFlight f1 : fromOrigin) {
            if (f1.getDepTimeUtc().isBefore(s.getRegisteredAt())) continue;
            if (!sol.canAssign(f1.getId(), qty)) continue;
            String hub = f1.getDestIata();
            if (hub == null || hub.equals(dest)) continue;
            byOrigin.getOrDefault(hub, List.of()).stream()
                    .filter(f2 -> dest.equals(f2.getDestIata()))
                    .filter(f2 -> sol.canAssign(f2.getId(), qty))
                    .filter(f2 -> Duration.between(f1.getArrTimeUtc(), f2.getDepTimeUtc())
                                          .toMinutes() >= CONNECT_MIN_GAP_MINUTES)
                    .forEach(f2 -> candidates.add(List.of(f1.getId(), f2.getId())));
        }

        candidates.sort(Comparator.comparingDouble(seq -> insertionCost(seq, s, sol)));
        return candidates;
    }

    private double insertionCost(List<Long> seq, OpsShipment s, OpsAlnsSolution sol) {
        if (seq == null || seq.isEmpty()) return Double.MAX_VALUE;
        OpsFlight first = sol.getFlightMap().get(seq.get(0));
        if (first == null) return Double.MAX_VALUE;
        return Duration.between(s.getRegisteredAt(), first.getDepTimeUtc()).toMinutes();
    }

    // ── Construcción de rutas ─────────────────────────────────────────────────

    private List<OpsShipmentRoute> buildRoutes(OpsAlnsSolution sol) {
        List<OpsShipmentRoute> routes = new ArrayList<>();
        sol.getAssignments().forEach((shipmentId, flightIds) -> {
            OpsShipment shipment = sol.getShipmentMap().get(shipmentId);
            if (shipment == null) return;
            for (int i = 0; i < flightIds.size(); i++) {
                OpsFlight flight = sol.getFlightMap().get(flightIds.get(i));
                if (flight == null) continue;
                OpsShipmentRoute leg = new OpsShipmentRoute();
                leg.setShipment(shipment);
                leg.setFlight(flight);
                leg.setStepOrder(i + 1);
                leg.setStatus("PENDING");
                routes.add(leg);
            }
        });
        return routes;
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

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
            if (uses[i] > 0) weights[i] = (1 - rho) * weights[i] + rho * (scores[i] / uses[i]);
            weights[i] = Math.max(0.01, weights[i]);
            sum += weights[i];
        }
        for (int i = 0; i < weights.length; i++) weights[i] /= sum;
    }
}