package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.*;
import java.util.stream.Collectors;

public class RelatedRemoval implements DestroyOperator {

    @Override
    public void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng) {
        List<Long> assignedIds = solution.getAssignedBatchIds();
        if (assignedIds.isEmpty()) return;

        Long pivotId = assignedIds.get(rng.nextInt(assignedIds.size()));
        BaggageBatch pivot = allBatches.stream()
                .filter(b -> b.getId().equals(pivotId))
                .findFirst()
                .orElse(null);
        if (pivot == null) return;

        List<Long> firstFlightOfPivot = solution.getAssignment(pivotId);
        long pivotDep = firstFlightOfPivot.isEmpty() ? Long.MAX_VALUE :
                solution.getFlightDeparture(firstFlightOfPivot.get(0));

        String pivotDest = pivot.getDestinationAirport().getIataCode();

        List<Long> sorted = assignedIds.stream()
                .filter(id -> !id.equals(pivotId))
                .sorted(Comparator.comparingDouble(id -> computeSimilarity(id, pivotDest, pivotDep,
                        allBatches, solution)))
                .collect(Collectors.toList());

        solution.unassign(pivotId);
        for (Long id : sorted) {
            if (solution.getBankSize() >= q) break;
            solution.unassign(id);
        }
    }

    private double computeSimilarity(Long batchId, String pivotDest, long pivotDep,
                                      List<BaggageBatch> allBatches, AlnsSolution solution) {
        BaggageBatch b = allBatches.stream().filter(x -> x.getId().equals(batchId)).findFirst().orElse(null);
        if (b == null) return 10000.0;
        if (!b.getDestinationAirport().getIataCode().equals(pivotDest)) return 10000.0;
        List<Long> flights = solution.getAssignment(batchId);
        if (flights.isEmpty()) return 10000.0;
        long dep = solution.getFlightDeparture(flights.get(0));
        return Math.abs(dep - pivotDep) <= 120 * 60 * 1000L ? 0.0 : 10000.0;
    }

    @Override
    public String name() {
        return "RelatedRemoval";
    }
}
