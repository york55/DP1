package pe.pucp.tasfb2b.planner.alns.repair;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;
import pe.pucp.tasfb2b.planner.alns.DeadlineUtil;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

public class RegretKInsertion implements RepairOperator {

    // Penalización por minuto de atraso respecto al deadline SLA, aplicada en cost().
    // Es intencionalmente mucho más alta que el "costo" de esperar para embarcar (que es
    // ~1 unidad por minuto), para que el operador SIEMPRE prefiera una ruta que llega a
    // tiempo aunque implique esperar más para embarcar, en vez de la que embarca primero
    // pero llega después del plazo.
    private static final double LATE_PENALTY_PER_MINUTE = 5.0;

    private final int connectMinGapMinutes;
    private final int maxHops;

    public RegretKInsertion(int connectMinGapMinutes, int maxHops) {
        this.connectMinGapMinutes = connectMinGapMinutes;
        this.maxHops = maxHops;
    }

    public RegretKInsertion(int connectMinGapMinutes) {
        this(connectMinGapMinutes, 2);
    }

    public RegretKInsertion() {
        this(30, 2);
    }

    @Override
    public void repair(AlnsSolution solution, List<BaggageBatch> allBatches,
                       List<Flight> availableFlights, int kRegret, Random rng) {

        // Index flights by origin airport to optimize lookup speed
        Map<String, List<Flight>> flightsByOrigin = availableFlights.stream()
                .collect(Collectors.groupingBy(f -> f.getOriginAirport().getIataCode()));

        Set<Long> bankSnapshot = new LinkedHashSet<>(solution.getBank());

        while (!bankSnapshot.isEmpty()) {
            Long bestBatchId = null;
            double bestRegret = Double.NEGATIVE_INFINITY;
            List<Long> bestFlightSequence = null;

            for (Long batchId : bankSnapshot) {
                BaggageBatch batch = solution.getBatchMap().get(batchId);
                if (batch == null) continue;

                List<List<Long>> candidates = findCandidateSequences(batch, flightsByOrigin, solution);

                double regret;
                List<Long> chosen;

                if (candidates.isEmpty()) {
                    regret = Double.MAX_VALUE;
                    chosen = null;
                } else if (candidates.size() == 1) {
                    regret = cost(candidates.get(0), batch, solution) + 10000.0;
                    chosen = candidates.get(0);
                } else {
                    double cost0 = cost(candidates.get(0), batch, solution);
                    int idx = Math.min(kRegret - 1, candidates.size() - 1);
                    double costK = cost(candidates.get(idx), batch, solution);
                    regret = costK - cost0;
                    chosen = candidates.get(0);
                }

                if (regret > bestRegret) {
                    bestRegret = regret;
                    bestBatchId = batchId;
                    bestFlightSequence = chosen;
                }
            }

            if (bestBatchId == null) break;

            if (bestFlightSequence != null) {
                solution.assign(bestBatchId, bestFlightSequence);
            } else {
                bankSnapshot.remove(bestBatchId);
                // leave in bank (unassigned)
            }
            bankSnapshot.remove(bestBatchId);
        }
    }

    private List<List<Long>> findCandidateSequences(BaggageBatch batch,
                                                      Map<String, List<Flight>> flightsByOrigin,
                                                      AlnsSolution solution) {
        String origin = batch.getOriginAirport().getIataCode();
        String dest = batch.getDestinationAirport().getIataCode();
        int qty = batch.getQuantity();

        List<List<Long>> candidates = new ArrayList<>();

        List<Flight> departingOrigin = flightsByOrigin.getOrDefault(origin, Collections.emptyList());

        // Direct flights
        for (Flight f : departingOrigin) {
            if (!f.getDestinationAirport().getIataCode().equals(dest)) continue;
            if (f.getDepartureTime().isBefore(batch.getAvailableFrom())) continue;
            if (!solution.canAssign(f.getId(), qty)) continue;
            candidates.add(List.of(f.getId()));
        }

        // 2-hop connections
        if (maxHops >= 2) {
            for (Flight f1 : departingOrigin) {
                if (f1.getDepartureTime().isBefore(batch.getAvailableFrom())) continue;
                if (!solution.canAssign(f1.getId(), qty)) continue;
                String hub = f1.getDestinationAirport().getIataCode();
                if (hub.equals(dest)) continue;

                List<Flight> departingHub = flightsByOrigin.getOrDefault(hub, Collections.emptyList());
                for (Flight f2 : departingHub) {
                    if (!f2.getDestinationAirport().getIataCode().equals(dest)) continue;
                    if (!solution.canAssign(f2.getId(), qty)) continue;
                    long gap = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                    if (gap < connectMinGapMinutes) continue;
                    candidates.add(List.of(f1.getId(), f2.getId()));
                }
            }
        }

        // 3-hop connections: solo se exploran cuando NO existe ninguna opción directa ni de
        // 1 escala. Antes, un lote que necesitaba 2 conexiones para llegar a destino se
        // quedaba atrapado en el banco (sin asignar) para siempre, bloque tras bloque, porque
        // findCandidateSequences nunca generaba ese candidato. Se acota a "candidates.isEmpty()"
        // para no pagar el costo combinatorio de un tercer salto en el caso común (directo/1 escala).
        if (maxHops >= 3 && candidates.isEmpty()) {
            for (Flight f1 : departingOrigin) {
                if (f1.getDepartureTime().isBefore(batch.getAvailableFrom())) continue;
                if (!solution.canAssign(f1.getId(), qty)) continue;
                String hub1 = f1.getDestinationAirport().getIataCode();
                if (hub1.equals(dest) || hub1.equals(origin)) continue;

                List<Flight> departingHub1 = flightsByOrigin.getOrDefault(hub1, Collections.emptyList());
                for (Flight f2 : departingHub1) {
                    String hub2 = f2.getDestinationAirport().getIataCode();
                    if (hub2.equals(origin) || hub2.equals(hub1)) continue;
                    if (!solution.canAssign(f2.getId(), qty)) continue;
                    long gap1 = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                    if (gap1 < connectMinGapMinutes) continue;

                    List<Flight> departingHub2 = flightsByOrigin.getOrDefault(hub2, Collections.emptyList());
                    for (Flight f3 : departingHub2) {
                        if (!f3.getDestinationAirport().getIataCode().equals(dest)) continue;
                        if (!solution.canAssign(f3.getId(), qty)) continue;
                        long gap2 = Duration.between(f2.getArrivalTime(), f3.getDepartureTime()).toMinutes();
                        if (gap2 < connectMinGapMinutes) continue;
                        candidates.add(List.of(f1.getId(), f2.getId(), f3.getId()));
                    }
                }
            }
        }

        // Sort by insertion cost (ahora incluye penalización por atraso SLA, ver cost())
        candidates.sort(Comparator.comparingDouble(seq -> cost(seq, batch, solution)));
        return candidates;
    }

    private double cost(List<Long> flightSeq, BaggageBatch batch, AlnsSolution solution) {
        if (flightSeq == null || flightSeq.isEmpty()) return Double.MAX_VALUE;
        Flight first = solution.getFlightMap().get(flightSeq.get(0));
        Flight last = solution.getFlightMap().get(flightSeq.get(flightSeq.size() - 1));
        if (first == null || last == null) return Double.MAX_VALUE;

        double boardWaitMin = Duration.between(batch.getAvailableFrom(), first.getDepartureTime()).toMinutes();

        LocalDateTime deadline = DeadlineUtil.computeDeadline(batch);
        long lateMin = Duration.between(deadline, last.getArrivalTime()).toMinutes();
        double latenessPenalty = lateMin > 0 ? lateMin * LATE_PENALTY_PER_MINUTE : 0.0;

        return boardWaitMin + latenessPenalty;
    }

    @Override
    public String name() {
        return "RegretKInsertion";
    }
}
