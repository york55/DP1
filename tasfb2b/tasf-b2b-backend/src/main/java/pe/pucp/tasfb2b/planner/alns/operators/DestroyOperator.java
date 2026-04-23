package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import java.util.List;

public interface DestroyOperator {
    List<String> destroy(Solution solution, Scenario scenario, AlnsParams params, int q);
    String name();
}
