package pe.pucp.tasfb2b.planner.alns.repair;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.List;
import java.util.Random;

public interface RepairOperator {

    void repair(AlnsSolution solution, List<BaggageBatch> allBatches,
                List<Flight> availableFlights, int kRegret, Random rng);

    String name();
}
