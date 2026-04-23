package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import java.util.List;

public interface RepairOperator {
    void repair(Solution solution, List<String> unassignedPool, Scenario scenario, AlnsParams params);
    String name();
}
