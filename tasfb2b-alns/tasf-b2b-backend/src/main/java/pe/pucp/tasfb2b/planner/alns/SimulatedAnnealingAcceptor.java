package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.util.Random64;

public class SimulatedAnnealingAcceptor {
    private double temperature;
    private final double alpha;
    private final Random64 random;

    public SimulatedAnnealingAcceptor(double t0, double alpha, long seed) {
        this.temperature = t0;
        this.alpha = alpha;
        this.random = new Random64(seed);
    }

    public boolean accept(double fCurrent, double fCandidate) {
        if (fCandidate <= fCurrent) return true;
        double prob = Math.exp(-(fCandidate - fCurrent) / temperature);
        return random.nextDouble() <= prob;
    }

    public void coolDown() {
        temperature *= alpha;
    }
}
