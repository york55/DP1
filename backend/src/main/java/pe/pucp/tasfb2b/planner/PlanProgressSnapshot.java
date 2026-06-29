package pe.pucp.tasfb2b.planner;

public record PlanProgressSnapshot(
        String phase,
        int iteration,
        int maxIterations,
        int assignedBatches,
        int totalBatches,
        double currentObjective,
        int blockIndex,
        int totalBlocks,
        String blockWindowStart,
        String blockWindowEnd
) {}
