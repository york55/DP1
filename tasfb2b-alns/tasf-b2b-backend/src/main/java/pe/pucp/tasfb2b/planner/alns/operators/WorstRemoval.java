package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.util.Random64;

import java.time.Duration;
import java.util.*;

public class WorstRemoval implements DestroyOperator {
    private final Random64 random;
    public WorstRemoval(long seed) { this.random = new Random64(seed); }

    @Override
    public List<String> destroy(Solution solution, Scenario scenario, AlnsParams params, int q) {
        List<String> removed = new ArrayList<>();
        
        List<CostEntry> costs = new ArrayList<>();
        for (var entry : solution.asignaciones().entrySet()) {
            if (entry.getValue().estado() == ShipmentStatus.ASSIGNED) {
                var envio = scenario.envios().stream().filter(e -> e.idEnvio().equals(entry.getKey())).findFirst().orElseThrow();
                var primerVuelo = entry.getValue().ruta().vuelos().get(0);
                long espera = Math.max(0, Duration.between(envio.horaDisponibilidadUtc(), primerVuelo.horaSalidaUtc()).toMinutes());
                double costo = espera * envio.cantidadMaletas();
                costs.add(new CostEntry(entry.getKey(), costo));
            }
        }
        
        costs.sort((a, b) -> Double.compare(b.costo, a.costo)); // descendente
        
        for (var c : costs) {
            if (removed.size() >= q) break;
            if (random.nextDouble() < params.pRuido()) continue; 
            
            removed.add(c.id);
            solution.asignaciones().put(c.id, new Solution.Assignment(c.id, ShipmentStatus.UNASSIGNED, null, null, 0));
        }
        
        for (var c : costs) {
            if (removed.size() >= q) break;
            if (!removed.contains(c.id)) {
                removed.add(c.id);
                solution.asignaciones().put(c.id, new Solution.Assignment(c.id, ShipmentStatus.UNASSIGNED, null, null, 0));
            }
        }
        
        return removed;
    }

    private record CostEntry(String id, double costo) {}
    
    @Override public String name() { return "WorstRemoval"; }
}
