package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.util.Random64;

import java.util.*;

public class RouteRemoval implements DestroyOperator {
    private final Random64 random;
    public RouteRemoval(long seed) { this.random = new Random64(seed); }

    @Override
    public List<String> destroy(Solution solution, Scenario scenario, AlnsParams params, int q) {
        List<String> removed = new ArrayList<>();
        Set<String> alreadyRemoved = new HashSet<>();
        
        while (removed.size() < q) {
            Map<String, List<String>> shipmentsPerFlight = new HashMap<>();
            for (var entry : solution.asignaciones().entrySet()) {
                if (entry.getValue().estado() == ShipmentStatus.ASSIGNED && !alreadyRemoved.contains(entry.getKey())) {
                    for (var v : entry.getValue().ruta().vuelos()) {
                        shipmentsPerFlight.computeIfAbsent(v.idVuelo(), k -> new ArrayList<>()).add(entry.getKey());
                    }
                }
            }
            
            if (shipmentsPerFlight.isEmpty()) break;
            
            List<String> flights = new ArrayList<>(shipmentsPerFlight.keySet());
            String chosenFlight = flights.get(random.nextInt(flights.size()));
            
            for (String shipmentId : shipmentsPerFlight.get(chosenFlight)) {
                if (!alreadyRemoved.contains(shipmentId)) {
                    removed.add(shipmentId);
                    alreadyRemoved.add(shipmentId);
                    solution.asignaciones().put(shipmentId, new Solution.Assignment(
                        shipmentId, ShipmentStatus.UNASSIGNED, null, null, 0
                    ));
                    if (removed.size() >= q) break;
                }
            }
        }
        return removed;
    }

    @Override public String name() { return "RouteRemoval"; }
}
