package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.Route;

import java.time.Duration;
import java.util.List;

public record OptimizationResult(
        List<Route> routes,
        int assignedCount,
        int failedCount,
        Duration computeTime,
        double objectiveValue,
        // IDs of BaggageBatch that ended up in the ALNS "bank" (no feasible route found).
        // These never produce a Route, so buildRoutes()/persistRoutes() would otherwise
        // silently skip them — leaving stale legs from a previous plan (e.g. a cancelled
        // flight's leg plus untouched future legs) in the database. Callers must use this
        // list to clean up / flag those batches explicitly. Never null (empty list if none).
        List<Long> bankedBatchIds
) {}