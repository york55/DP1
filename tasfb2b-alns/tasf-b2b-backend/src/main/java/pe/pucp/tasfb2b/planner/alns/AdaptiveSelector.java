package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.planner.alns.operators.DestroyOperator;
import pe.pucp.tasfb2b.util.Random64;

import java.util.List;

public class AdaptiveSelector {
    private final List<DestroyOperator> operators;
    private final double[] weights;
    private final double[] scores;
    private final int[] usages;
    private final Random64 random;

    public AdaptiveSelector(List<DestroyOperator> operators, long seed) {
        this.operators = operators;
        this.weights = new double[operators.size()];
        this.scores = new double[operators.size()];
        this.usages = new int[operators.size()];
        this.random = new Random64(seed);
        
        for (int i = 0; i < weights.length; i++) {
            weights[i] = 1.0;
        }
    }

    public DestroyOperator select() {
        double totalWeight = 0;
        for (double w : weights) totalWeight += w;
        
        double r = random.nextDouble() * totalWeight;
        double sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (r <= sum) {
                usages[i]++;
                return operators.get(i);
            }
        }
        usages[weights.length - 1]++;
        return operators.get(weights.length - 1);
    }

    public void updateScore(DestroyOperator op, double score) {
        int idx = operators.indexOf(op);
        if (idx >= 0) scores[idx] += score;
    }

    public void updateWeights(double rho) {
        for (int i = 0; i < weights.length; i++) {
            if (usages[i] > 0) {
                weights[i] = (1 - rho) * weights[i] + rho * (scores[i] / usages[i]);
            }
            scores[i] = 0;
            usages[i] = 0;
        }
    }
}
