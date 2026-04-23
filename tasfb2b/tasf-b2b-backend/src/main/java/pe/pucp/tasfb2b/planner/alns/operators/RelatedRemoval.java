package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Shipment;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.util.Random64;

import java.time.Duration;
import java.util.*;

public class RelatedRemoval implements DestroyOperator {
    private final Random64 random;
    public RelatedRemoval(long seed) { this.random = new Random64(seed); }

    @Override
    public List<String> destroy(Solution solution, Scenario scenario, AlnsParams params, int q) {
        List<String> removed = new ArrayList<>();
        List<String> assigned = new ArrayList<>();
        
        for (var entry : solution.asignaciones().entrySet()) {
            if (entry.getValue().estado() == ShipmentStatus.ASSIGNED) {
                assigned.add(entry.getKey());
            }
        }
        
        if (assigned.isEmpty()) return removed;
        
        String pivotId = assigned.get(random.nextInt(assigned.size()));
        removed.add(pivotId);
        solution.asignaciones().put(pivotId, new Solution.Assignment(pivotId, ShipmentStatus.UNASSIGNED, null, null, 0));
        
        Shipment pivot = getShipment(pivotId, scenario);
        
        assigned.remove(pivotId);
        assigned.sort(Comparator.comparingDouble(id -> similarity(pivot, getShipment(id, scenario))));
        
        for (int i = 0; i < assigned.size() && removed.size() < q; i++) {
            String id = assigned.get(i);
            removed.add(id);
            solution.asignaciones().put(id, new Solution.Assignment(id, ShipmentStatus.UNASSIGNED, null, null, 0));
        }
        return removed;
    }

    private Shipment getShipment(String id, Scenario s) {
        return s.envios().stream().filter(e -> e.idEnvio().equals(id)).findFirst().orElseThrow();
    }

    private double similarity(Shipment a, Shipment b) {
        if (!a.iataDestino().equals(b.iataDestino())) return 10000;
        long diff = Math.abs(Duration.between(a.horaDisponibilidadUtc(), b.horaDisponibilidadUtc()).toMinutes());
        if (diff <= 120) return diff;
        return 10000;
    }

    @Override public String name() { return "RelatedRemoval"; }
}
