package pe.pucp.tasfb2b.service;

import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.PlannerResult.Kpis;

import java.util.HashMap;
import java.util.Map;

@Service
public class KpiCalculator {

    public static Kpis calculate(Solution s, Scenario scenario) {
        int totalEnvios = scenario.envios().size();
        int enviosAsignados = 0;
        int entregasATiempo = 0;
        int maletasRetrasadas = 0;
        
        Map<String, Integer> maletasPorVuelo = new HashMap<>();

        for (var envio : scenario.envios()) {
            var asig = s.asignaciones().get(envio.idEnvio());
            if (asig != null && asig.estado() == ShipmentStatus.ASSIGNED && asig.ruta() != null && !asig.ruta().vuelos().isEmpty()) {
                enviosAsignados++;
                if (asig.retrasoMinutos() <= 0) {
                    entregasATiempo++;
                } else {
                    maletasRetrasadas += envio.cantidadMaletas();
                }
                
                for (var v : asig.ruta().vuelos()) {
                    maletasPorVuelo.put(v.idVuelo(), maletasPorVuelo.getOrDefault(v.idVuelo(), 0) + envio.cantidadMaletas());
                }
            }
        }

        double pctEnviosAsignados = totalEnvios > 0 ? (double) enviosAsignados / totalEnvios : 0;
        double pctEntregasATiempo = enviosAsignados > 0 ? (double) entregasATiempo / enviosAsignados : 0;

        double sumOcupacionVuelos = 0;
        int countVuelos = 0;
        for (Flight v : scenario.vuelos()) {
            if (v.cancelado()) continue;
            countVuelos++;
            int usados = maletasPorVuelo.getOrDefault(v.idVuelo(), 0);
            sumOcupacionVuelos += Math.min(1.0, (double) usados / v.capacidadMaletas());
        }
        double ocupacionPromedioVuelos = countVuelos > 0 ? sumOcupacionVuelos / countVuelos : 0;

        double ocupacionPromedioAlmacenes = 0.5; // placeholder as tracking full time-series is complex

        return new Kpis(
            pctEntregasATiempo,
            pctEnviosAsignados,
            ocupacionPromedioVuelos,
            ocupacionPromedioAlmacenes,
            maletasRetrasadas
        );
    }
}
