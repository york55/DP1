package pe.pucp.tasfb2b.planner.alns;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Route;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GreedyInitializer {

    private static final Logger log = LoggerFactory.getLogger(GreedyInitializer.class);

    public static Solution init(Scenario scenario) {
        Map<String, Solution.Assignment> asignaciones = new HashMap<>();
        Map<String, Integer> maletasPorVuelo = new HashMap<>();

        int assigned = 0, noRoute = 0, noCapacity = 0, noTime = 0;

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
                maletasPorVuelo.put(selected.idVuelo(), maletasPorVuelo.getOrDefault(selected.idVuelo(), 0) + envio.cantidadMaletas());
                assigned++;
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
        log.info("Greedy resultado: asignados={}, sinRuta={}, sinHorario={}, sinCapacidad={}, total={}", 
                assigned, noRoute, noTime, noCapacity, scenario.envios().size());
        return new Solution(asignaciones);
    }
}
