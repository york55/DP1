package pe.pucp.tasfb2b.planner.alns.operators;

import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Route;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;

import java.time.Duration;
import java.util.*;

public class RegretKInsertion implements RepairOperator {

    @Override
    public void repair(Solution solution, List<String> unassignedPool, Scenario scenario, AlnsParams params) {
        int k = params.k();
        List<String> remaining = new ArrayList<>(unassignedPool);

        while (!remaining.isEmpty()) {
            String bestShipment = null;
            double maxRegret = -1.0;
            Route bestRouteForShipment = null;

            for (String shipmentId : remaining) {
                var envio = scenario.envios().stream().filter(e -> e.idEnvio().equals(shipmentId)).findFirst().orElseThrow();
                List<InsertionOption> options = evaluateOptions(envio, scenario, solution);

                if (options.isEmpty()) continue;

                double regret;
                if (options.size() == 1) {
                    regret = options.get(0).costo;
                } else {
                    int kMax = Math.min(k, options.size());
                    regret = options.get(kMax - 1).costo - options.get(0).costo;
                }

                if (regret > maxRegret) {
                    maxRegret = regret;
                    bestShipment = shipmentId;
                    bestRouteForShipment = options.get(0).ruta;
                }
            }

            if (bestShipment != null) {
                remaining.remove(bestShipment);
                solution.asignaciones().put(bestShipment, new Solution.Assignment(
                        bestShipment, ShipmentStatus.ASSIGNED, bestRouteForShipment, null, 0
                ));
            } else {
                break;
            }
        }
    }

    private List<InsertionOption> evaluateOptions(pe.pucp.tasfb2b.domain.Shipment envio, Scenario scenario, Solution currentSol) {
        List<InsertionOption> options = new ArrayList<>();

        for (Flight v : scenario.vuelos()) {
            if (v.cancelado()) continue;
            if (v.iataOrigen().equals(envio.iataOrigen()) && v.iataDestino().equals(envio.iataDestino())) {
                if (!v.horaSalidaUtc().isBefore(envio.horaDisponibilidadUtc())) {
                    int used = calculateUsedCapacity(v.idVuelo(), currentSol, scenario);
                    if (used + envio.cantidadMaletas() <= v.capacidadMaletas()) {
                        long cost = Math.max(0, Duration.between(envio.horaDisponibilidadUtc(), v.horaSalidaUtc()).toMinutes());
                        options.add(new InsertionOption(new Route(List.of(v)), cost));
                    }
                }
            }
        }
        
        options.sort(Comparator.comparingDouble(o -> o.costo));
        return options;
    }

    private int calculateUsedCapacity(String flightId, Solution sol, Scenario scenario) {
        int used = 0;
        for (var asig : sol.asignaciones().values()) {
            if (asig.estado() == ShipmentStatus.ASSIGNED && asig.ruta() != null) {
                boolean contains = false;
                for (var v : asig.ruta().vuelos()) {
                    if (v.idVuelo().equals(flightId)) { contains = true; break; }
                }
                if (contains) {
                    var sh = scenario.envios().stream().filter(e->e.idEnvio().equals(asig.idEnvio())).findFirst().get();
                    used += sh.cantidadMaletas();
                }
            }
        }
        return used;
    }

    private record InsertionOption(Route ruta, double costo) {}

    @Override public String name() { return "RegretKInsertion"; }
}
