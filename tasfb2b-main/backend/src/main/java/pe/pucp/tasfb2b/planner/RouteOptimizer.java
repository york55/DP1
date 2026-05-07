package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.BaggageBatch;

import java.util.List;

public interface RouteOptimizer {

    OptimizationResult optimize(SimulationContext context);

    OptimizationResult replan(List<BaggageBatch> affected, SimulationContext context);

    String algorithmName();
}
