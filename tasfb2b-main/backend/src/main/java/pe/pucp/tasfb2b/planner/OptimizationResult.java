package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.Route;

import java.time.Duration;
import java.util.List;

public record OptimizationResult(
        List<Route> routes,
        int assignedCount,
        int failedCount,
        Duration computeTime,
        double objectiveValue
) {}
