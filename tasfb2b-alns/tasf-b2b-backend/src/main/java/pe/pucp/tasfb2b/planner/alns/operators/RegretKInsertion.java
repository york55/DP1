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

        Map<String, pe.pucp.tasfb2b.domain.Shipment> envioMap = buildEnvioMap(scenario);
        Map<String, List<Flight>> flightIndex = buildFlightIndex(scenario);
        Map<String, Integer> shipmentBags = buildShipmentBagsMap(scenario);
        Map<String, Integer> flightCapacityUsed = calculateFlightUsage(solution, shipmentBags);

        while (!remaining.isEmpty()) {
            String bestShipment = null;
            double maxRegret = -1.0;
            Route bestRouteForShipment = null;

            for (String shipmentId : remaining) {
                var envio = envioMap.get(shipmentId);
                if (envio == null) continue;
                List<InsertionOption> options = evaluateOptions(envio, flightIndex, flightCapacityUsed, solution);

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
                var asig = new Solution.Assignment(
                        bestShipment, ShipmentStatus.ASSIGNED, bestRouteForShipment, null, 0
                );
                solution.asignaciones().put(bestShipment, asig);

                int bags = shipmentBags.getOrDefault(bestShipment, 0);
                for (var v : asig.ruta().vuelos()) {
                    flightCapacityUsed.merge(v.idVuelo(), bags, Integer::sum);
                }
            } else {
                break;
            }
        }
    }

    private Map<String, pe.pucp.tasfb2b.domain.Shipment> buildEnvioMap(Scenario scenario) {
        Map<String, pe.pucp.tasfb2b.domain.Shipment> map = new HashMap<>();
        for (var s : scenario.envios()) {
            map.put(s.idEnvio(), s);
        }
        return map;
    }

    private Map<String, List<Flight>> buildFlightIndex(Scenario scenario) {
        Map<String, List<Flight>> index = new HashMap<>();
        for (Flight f : scenario.vuelos()) {
            if (f.cancelado()) continue;
            String key = f.iataOrigen() + "->" + f.iataDestino();
            index.computeIfAbsent(key, k -> new ArrayList<>()).add(f);
        }
        return index;
    }

    private Map<String, Integer> buildShipmentBagsMap(Scenario scenario) {
        Map<String, Integer> map = new HashMap<>();
        for (var s : scenario.envios()) {
            map.put(s.idEnvio(), s.cantidadMaletas());
        }
        return map;
    }

    private Map<String, Integer> calculateFlightUsage(Solution sol, Map<String, Integer> shipmentBags) {
        Map<String, Integer> usage = new HashMap<>();
        for (var asig : sol.asignaciones().values()) {
            if (asig.estado() == ShipmentStatus.ASSIGNED && asig.ruta() != null) {
                int bags = shipmentBags.getOrDefault(asig.idEnvio(), 0);
                for (var v : asig.ruta().vuelos()) {
                    usage.merge(v.idVuelo(), bags, Integer::sum);
                }
            }
        }
        return usage;
    }

    private List<InsertionOption> evaluateOptions(pe.pucp.tasfb2b.domain.Shipment envio,
            Map<String, List<Flight>> flightIndex, Map<String, Integer> flightCapacityUsed, Solution currentSol) {
        List<InsertionOption> options = new ArrayList<>();
        String key = envio.iataOrigen() + "->" + envio.iataDestino();
        List<Flight> candidates = flightIndex.get(key);
        if (candidates == null) return options;

        int bags = envio.cantidadMaletas();
        var availability = envio.horaDisponibilidadUtc();

        for (Flight v : candidates) {
            if (v.horaSalidaUtc().isBefore(availability)) continue;
            int used = flightCapacityUsed.getOrDefault(v.idVuelo(), 0);
            if (used + bags <= v.capacidadMaletas()) {
                long cost = Math.max(0, Duration.between(availability, v.horaSalidaUtc()).toMinutes());
                options.add(new InsertionOption(new Route(List.of(v)), cost));
            }
        }

        options.sort(Comparator.comparingDouble(o -> o.costo));
        return options;
    }

    private record InsertionOption(Route ruta, double costo) {}

    @Override public String name() { return "RegretKInsertion"; }
}
