package pe.pucp.tasfb2b.planner.alns;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Route;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Shipment;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GreedyInitializer {

    private static final Logger log = LoggerFactory.getLogger(GreedyInitializer.class);
    private static final long TRANSFER_MINUTES = 60;

    public static Solution init(Scenario scenario) {
        Map<String, Solution.Assignment> asignaciones = new HashMap<>();
        Map<String, Integer> maletasPorVuelo = new HashMap<>();

        int assigned = 0, noRoute = 0, noCapacity = 0, noTime = 0, multiHop = 0;

        for (var envio : scenario.envios()) {
            Flight selected = null;
            boolean foundRoute = false;
            boolean foundTime = false;
            boolean foundCapacity = false;

            for (var v : scenario.vuelos()) {
                if (v.cancelado()) continue;
                if (v.iataOrigen().equals(envio.iataOrigen()) && v.iataDestino().equals(envio.iataDestino())) {
                    foundRoute = true;
                    if (!v.horaSalidaUtc().isBefore(envio.horaDisponibilidadUtc())) {
                        foundTime = true;
                        int usados = maletasPorVuelo.getOrDefault(v.idVuelo(), 0);
                        if (usados + envio.cantidadMaletas() <= v.capacidadMaletas()) {
                            foundCapacity = true;
                            if (selected == null || v.horaSalidaUtc().isBefore(selected.horaSalidaUtc())) {
                                selected = v;
                            }
                        }
                    }
                }
            }

            if (selected != null) {
                asignaciones.put(envio.idEnvio(), new Solution.Assignment(
                    envio.idEnvio(), ShipmentStatus.ASSIGNED, new Route(List.of(selected)), selected.horaLlegadaUtc(), 0
                ));
                maletasPorVuelo.merge(selected.idVuelo(), envio.cantidadMaletas(), Integer::sum);
                assigned++;
            } else {
                Route twoHop = findTwoHopRoute(envio, scenario.vuelos(), maletasPorVuelo);
                if (twoHop != null) {
                    Flight leg1 = twoHop.vuelos().get(0);
                    Flight leg2 = twoHop.vuelos().get(1);
                    asignaciones.put(envio.idEnvio(), new Solution.Assignment(
                        envio.idEnvio(), ShipmentStatus.ASSIGNED, twoHop, leg2.horaLlegadaUtc(), 0
                    ));
                    maletasPorVuelo.merge(leg1.idVuelo(), envio.cantidadMaletas(), Integer::sum);
                    maletasPorVuelo.merge(leg2.idVuelo(), envio.cantidadMaletas(), Integer::sum);
                    assigned++;
                    multiHop++;
                } else {
                    String reason = !foundRoute ? "SIN_RUTA" : (!foundTime ? "SIN_HORARIO" : (!foundCapacity ? "SIN_CAPACIDAD" : "DESCONOCIDO"));
                    log.debug("  NO ASIGNADO: {} ({}->{}, {} maletas) -> Razon: {}",
                        envio.idEnvio(), envio.iataOrigen(), envio.iataDestino(), envio.cantidadMaletas(), reason);
                    asignaciones.put(envio.idEnvio(), new Solution.Assignment(
                        envio.idEnvio(), ShipmentStatus.UNASSIGNED, null, null, 0
                    ));
                    if (!foundRoute) noRoute++;
                    else if (!foundTime) noTime++;
                    else noCapacity++;
                }
            }
        }
        log.info("Greedy resultado: asignados={} (multiHop={}), sinRuta={}, sinHorario={}, sinCapacidad={}, total={}",
                assigned, multiHop, noRoute, noTime, noCapacity, scenario.envios().size());
        return new Solution(asignaciones);
    }

    private static Route findTwoHopRoute(Shipment envio, List<Flight> allFlights, Map<String, Integer> maletasPorVuelo) {
        Route bestRoute = null;
        Instant bestArrival = null;

        for (Flight leg1 : allFlights) {
            if (leg1.cancelado()) continue;
            if (!leg1.iataOrigen().equals(envio.iataOrigen())) continue;
            if (leg1.iataDestino().equals(envio.iataDestino())) continue;
            if (leg1.horaSalidaUtc().isBefore(envio.horaDisponibilidadUtc())) continue;
            int used1 = maletasPorVuelo.getOrDefault(leg1.idVuelo(), 0);
            if (used1 + envio.cantidadMaletas() > leg1.capacidadMaletas()) continue;

            Instant earliestLeg2Departure = leg1.horaLlegadaUtc().plusSeconds(TRANSFER_MINUTES * 60L);

            for (Flight leg2 : allFlights) {
                if (leg2.cancelado()) continue;
                if (!leg2.iataOrigen().equals(leg1.iataDestino())) continue;
                if (!leg2.iataDestino().equals(envio.iataDestino())) continue;
                if (leg2.horaSalidaUtc().isBefore(earliestLeg2Departure)) continue;
                int used2 = maletasPorVuelo.getOrDefault(leg2.idVuelo(), 0);
                if (used2 + envio.cantidadMaletas() > leg2.capacidadMaletas()) continue;

                if (bestArrival == null || leg2.horaLlegadaUtc().isBefore(bestArrival)) {
                    bestArrival = leg2.horaLlegadaUtc();
                    bestRoute = new Route(List.of(leg1, leg2));
                }
            }
        }
        return bestRoute;
    }
}
