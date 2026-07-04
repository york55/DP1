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
        double w5,
        int kRegret,
        int connectMinGapMinutes,
        int maxHops
) {
    // Notas de calibración:
    // - t0 > 1.0 se interpreta como "legado" y AlnsEngine auto-calibra la temperatura a la
    //   escala real del objetivo (ver comentario en AlnsEngine.optimize). Para fijar una
    //   temperatura explícita, pasar un t0 <= 1.0.
    // - maxIterations sube de 200 a 1000: con la caché de candidatos de RegretKInsertion el
    //   costo por iteración cae en órdenes de magnitud, y la terminación anticipada por
    //   estancamiento (3 segmentos sin mejora = 300 iteraciones) corta las corridas que ya
    //   convergieron.
    // - alpha 0.995: con 1000 iteraciones enfría hasta ~0.7% de T0 (0.9995 apenas bajaba
    //   a 60% en 200 iteraciones, o sea casi no había recocido).
    // - w4 (consolidación/utilización) baja de 0.15 a 0.05 y w5 (puntualidad SLA) sube de
    //   0.25 a 0.35: consolidar carga tiende a hacer esperar maletas a vuelos más llenos,
    //   lo que compite directamente contra "cero retrasos" y contra vaciar almacenes rápido.
    public static AlnsParams defaults() {
        return new AlnsParams(100.0, 0.995, 0.25, 1000, 100,
                9.0, 3.0, 1.0, 0.1, 0.05,
                0.50, 0.10, 0.10, 0.05, 0.35, 3, 30, 3);
    }

    public static AlnsParams fast() {
        return new AlnsParams(50.0, 0.99, 0.30, 400, 50,
                9.0, 3.0, 1.0, 0.1, 0.05,
                0.50, 0.10, 0.10, 0.05, 0.35, 3, 30, 3);
    }
}
