package pe.pucp.tasfb2b.planner.alns;

public record AlnsParams(
        double t0,
        double alpha,
        double qPct,
        int maxIterations,
        int segLen,
        double sigma1,
        double sigma2,
        double sigma3,
        double rho,
        double pNoise,
        double w1,
        double w2,
        double w3,
        double w4,
        int kRegret,
        int connectMinGapMinutes
) {
    public static AlnsParams defaults() {
        return new AlnsParams(100.0, 0.9995, 0.25, 200, 100,
                9.0, 3.0, 1.0, 0.1, 0.05,
                0.60, 0.10, 0.10, 0.20, 3, 30);
    }

    public static AlnsParams fast() {
        return new AlnsParams(50.0, 0.999, 0.30, 200, 50,
                9.0, 3.0, 1.0, 0.1, 0.05,
                0.60, 0.10, 0.10, 0.20, 3, 30);
    }
}
