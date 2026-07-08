package pe.pucp.tasfb2b.planner.alns.destroy;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.*;
import java.util.stream.Collectors;

public class RelatedRemoval implements DestroyOperator {

    @Override
    public void destroy(AlnsSolution solution, List<BaggageBatch> allBatches, int q, Random rng) {
        List<Long> assignedIds = solution.getAssignedBatchIds();
        if (assignedIds.isEmpty()) return;

        // Pivote dirigido: si existe algún lote TARDÍO, con probabilidad 50% se usa el más
        // tardío como pivote en lugar de uno al azar. Así la destrucción se concentra
        // exactamente alrededor del problema: se remueven el lote tardío Y los lotes que
        // comparten sus vuelos (los que le bloquean la capacidad puntual), dándole al
        // regret-k la oportunidad de reordenarlos con el tardío entrando primero.
        Long pivotId = null;
        if (rng.nextBoolean()) {
            long worstLate = 0;
            for (Long id : assignedIds) {
                long late = solution.getLatenessMinutes(id);
                if (late > worstLate) {
                    worstLate = late;
                    pivotId = id;
                }
            }
        }
        if (pivotId == null) {
            pivotId = assignedIds.get(rng.nextInt(assignedIds.size()));
        }
        final Long pivot = pivotId;
        // Lookup por id UNA vez: antes computeSimilarity hacía un stream().filter() lineal
        // sobre allBatches por CADA comparación del sort — O(n² log n) a escala.
        Map<Long, BaggageBatch> batchById = allBatches.stream()
                .collect(Collectors.toMap(BaggageBatch::getId, b -> b, (a, b) -> a));
        BaggageBatch pivotBatch = batchById.get(pivot);
        if (pivotBatch == null) return;

        List<Long> pivotFlights = solution.getAssignment(pivot);
        Set<Long> pivotFlightSet = new HashSet<>(pivotFlights);
        long pivotDep = pivotFlights.isEmpty() ? Long.MAX_VALUE :
                solution.getFlightDeparture(pivotFlights.get(0));

        String pivotDest = pivotBatch.getDestinationAirport().getIataCode();

        Map<Long, Double> similarityOf = new HashMap<>(assignedIds.size() * 2);
        for (Long id : assignedIds) {
            if (id.equals(pivot)) continue;
            similarityOf.put(id, computeSimilarity(id, pivotDest, pivotDep,
                    pivotFlightSet, batchById, solution));
        }

        List<Long> sorted = assignedIds.stream()
                .filter(id -> !id.equals(pivot))
                .sorted(Comparator.comparingDouble(similarityOf::get))
                .collect(Collectors.toList());

        solution.unassign(pivot);
        for (Long id : sorted) {
            if (solution.getBankSize() >= q) break;
            solution.unassign(id);
        }
    }

    private double computeSimilarity(Long batchId, String pivotDest, long pivotDep,
                                      Set<Long> pivotFlights,
                                      Map<Long, BaggageBatch> batchById, AlnsSolution solution) {
        List<Long> flights = solution.getAssignment(batchId);
        if (flights.isEmpty()) return 10000.0;
        // Máxima afinidad: comparte al menos un vuelo con el pivote — es un bloqueador
        // directo de su capacidad.
        for (Long fid : flights) {
            if (pivotFlights.contains(fid)) return 0.0;
        }
        BaggageBatch b = batchById.get(batchId);
        if (b == null) return 10000.0;
        if (!b.getDestinationAirport().getIataCode().equals(pivotDest)) return 10000.0;
        long dep = solution.getFlightDeparture(flights.get(0));
        return Math.abs(dep - pivotDep) <= 120 * 60 * 1000L ? 1.0 : 100.0;
    }

    @Override
    public String name() {
        return "RelatedRemoval";
    }
}
