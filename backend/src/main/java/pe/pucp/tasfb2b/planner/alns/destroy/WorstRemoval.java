package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.*;
import java.util.stream.Collectors;

public class WorstRemoval implements DestroyOperator {

    private final double pNoise;

    public WorstRemoval(double pNoise) {
        this.pNoise = pNoise;
    }

    @Override
    public void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng) {
        List<Long> assignedIds = solution.getAssignedBatchIds();
        if (assignedIds.isEmpty()) return;

        Map<Long, Integer> quantityMap = allBatches.stream()
                .collect(Collectors.toMap(BaggageBatch::getId, BaggageBatch::getQuantity));

        // Costos precomputados UNA vez: el comparador de sort() llama a la función de costo
        // O(n log n) veces, y computeCost recorre los tramos de la ruta — a escala de miles
        // de lotes eso dominaba el tiempo del operador.
        Map<Long, Double> costOf = new HashMap<>(assignedIds.size() * 2);
        for (Long id : assignedIds) {
            costOf.put(id, computeCost(id, solution, quantityMap));
        }

        List<Long> sorted = assignedIds.stream()
                .sorted((a, b) -> Double.compare(costOf.get(b), costOf.get(a)))
                .collect(Collectors.toList());

        for (Long id : sorted) {
            if (solution.getBankSize() >= q) break;
            if (rng.nextDouble() < pNoise) continue;
            solution.unassign(id);
        }
    }

    // Peso con el que se castiga el atraso frente al SLA respecto al simple tiempo de
    // espera para embarcar. Antes esta función solo miraba waitMin, así que un lote que
    // ya iba a llegar tarde no tenía ninguna prioridad especial para ser reconsiderado.
    private static final double LATENESS_WEIGHT = 10.0;

    private double computeCost(Long batchId, AlnsSolution solution, Map<Long, Integer> quantities) {
        // Tiempo en tierra total (origen + layovers en hubs): un lote con un layover de 20h
        // en un hub es tan candidato a reconsiderarse como uno que espera 20h en el origen.
        long groundMin = solution.getGroundMinutes(batchId);
        long lateMin = solution.getLatenessMinutes(batchId);
        int qty = quantities.getOrDefault(batchId, 1);
        return (groundMin + lateMin * LATENESS_WEIGHT) * qty;
    }

    @Override
    public String name() {
        return "WorstRemoval";
    }
}
