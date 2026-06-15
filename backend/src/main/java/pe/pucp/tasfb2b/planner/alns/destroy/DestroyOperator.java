package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.List;
import java.util.Random;

public interface DestroyOperator {

    void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng);

    String name();
}
