package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.*;
import java.util.stream.Collectors;

public class WorstRemoval implements DestroyOperator {

    private final double pNoise;

    public WorstRemoval(double pNoise) {
        this.pNoise = pNoise;
    }

    @Override
    public void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng) {
        List<Long> assignedIds = solution.getAssignedBatchIds();
        if (assignedIds.isEmpty()) return;

        Map<Long, Integer> quantityMap = allBatches.stream()
                .collect(Collectors.toMap(BaggageBatch::getId, BaggageBatch::getQuantity));

        List<Long> sorted = assignedIds.stream()
                .sorted((a, b) -> {
                    double costA = computeCost(a, solution, quantityMap);
                    double costB = computeCost(b, solution, quantityMap);
                    return Double.compare(costB, costA);
                })
                .collect(Collectors.toList());

        for (Long id : sorted) {
            if (solution.getBankSize() >= q) break;
            if (rng.nextDouble() < pNoise) continue;
            solution.unassign(id);
        }
    }

    private double computeCost(Long batchId, AlnsSolution solution, Map<Long, Integer> quantities) {
        long waitMin = solution.getWaitingMinutes(batchId);
        int qty = quantities.getOrDefault(batchId, 1);
        return waitMin * qty;
    }

    @Override
    public String name() {
        return "WorstRemoval";
    }
}
