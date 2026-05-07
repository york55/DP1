package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.*;

public class RouteRemoval implements DestroyOperator {

    @Override
    public void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng) {
        List<Long> flightIds = new ArrayList<>(solution.getFlightIds());
        if (flightIds.isEmpty()) return;

        Collections.shuffle(flightIds, rng);

        for (Long flightId : flightIds) {
            if (solution.getBankSize() >= q) break;
            List<Long> batchesOnFlight = solution.getBatchesOnFlight(flightId);
            for (Long batchId : new ArrayList<>(batchesOnFlight)) {
                solution.unassign(batchId);
            }
        }
    }

    @Override
    public String name() {
        return "RouteRemoval";
    }
}
