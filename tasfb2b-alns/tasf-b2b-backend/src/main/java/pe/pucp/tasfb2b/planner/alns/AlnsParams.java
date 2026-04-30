package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.planner.PlannerParams;

public record AlnsParams(
    int nMax,
    double qPct,
    double t0,
    double alpha,
    double sigma1,
    double sigma2,
    double sigma3,
    double rho,
    int segLen,
    int k,
    double pRuido
) implements PlannerParams {
    public static AlnsParams defaultConfig() {
        return new AlnsParams(1500, 0.10, 1.0, 0.9995, 9.0, 3.0, 1.0, 0.1, 50, 3, 0.1);
    }
}
