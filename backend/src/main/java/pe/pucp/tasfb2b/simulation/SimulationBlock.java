package pe.pucp.tasfb2b.simulation;

import java.time.LocalDateTime;

public record SimulationBlock(
        int blockIndex,
        LocalDateTime start,
        LocalDateTime end,
        int batchesPlanned
) {}
