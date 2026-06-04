package pe.pucp.tasfb2b.planner.alns.repair;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

public class RegretKInsertion implements RepairOperator {

    private static final int CONNECT_MIN_GAP_MINUTES = 30;

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
                if (gap < CONNECT_MIN_GAP_MINUTES) continue;
                candidates.add(List.of(f1.getId(), f2.getId()));
            }
        }

        // Sort by insertion cost
        candidates.sort(Comparator.comparingDouble(seq -> cost(seq, batch, solution)));
        return candidates;
    }

    private double cost(List<Long> flightSeq, BaggageBatch batch, AlnsSolution solution) {
        if (flightSeq == null || flightSeq.isEmpty()) return Double.MAX_VALUE;
        Long firstId = flightSeq.get(0);
        Flight first = solution.getFlightMap().get(firstId);
        if (first == null) return Double.MAX_VALUE;
        return Duration.between(batch.getAvailableFrom(), first.getDepartureTime()).toMinutes();
    }

    @Override
    public String name() {
        return "RegretKInsertion";
    }
}
