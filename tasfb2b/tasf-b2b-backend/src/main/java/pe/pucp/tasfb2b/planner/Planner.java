package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.Scenario;

public interface Planner {
    PlannerResult plan(Scenario scenario, PlannerParams params);
    String name();
}
