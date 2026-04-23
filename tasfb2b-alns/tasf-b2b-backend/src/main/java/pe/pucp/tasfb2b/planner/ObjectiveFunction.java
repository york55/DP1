package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

public class ObjectiveFunction {

    public static PlannerResult.ObjectiveFunctionResult evaluate(Solution s, Scenario scenario) {
        int totalLotes = scenario.envios().size();
        int lotesSinAsignar = 0;
        int lotesAsignados = 0;
        long esperaTotalMinutos = 0;

        Map<String, Integer> maletasPorVuelo = new HashMap<>();

        for (var envio : scenario.envios()) {
            var asig = s.asignaciones().get(envio.idEnvio());
            if (asig == null || asig.estado() != ShipmentStatus.ASSIGNED || asig.ruta() == null || asig.ruta().vuelos().isEmpty()) {
                lotesSinAsignar++;
            } else {
                lotesAsignados++;
                var primerVuelo = asig.ruta().vuelos().get(0);
                long espera = Math.max(0, Duration.between(envio.horaDisponibilidadUtc(), primerVuelo.horaSalidaUtc()).toMinutes());
                esperaTotalMinutos += espera;

                for (var v : asig.ruta().vuelos()) {
                    maletasPorVuelo.put(v.idVuelo(), maletasPorVuelo.getOrDefault(v.idVuelo(), 0) + envio.cantidadMaletas());
                }
            }
        }

        int capacidadTotalRed = 0;
        int sobrecapacidadTotal = 0;
        for (Flight v : scenario.vuelos()) {
            if (v.cancelado()) continue;
            capacidadTotalRed += v.capacidadMaletas();
            int usados = maletasPorVuelo.getOrDefault(v.idVuelo(), 0);
            if (usados > v.capacidadMaletas()) {
                sobrecapacidadTotal += (usados - v.capacidadMaletas());
            }
        }

        double fracSinAsignar = totalLotes > 0 ? (double) lotesSinAsignar / totalLotes : 0;
        double fracSobrecapacidad = capacidadTotalRed > 0 ? (double) sobrecapacidadTotal / capacidadTotalRed : 0;
        double fracEspera = lotesAsignados > 0 ? (double) esperaTotalMinutos / (lotesAsignados * 1440.0) : 0;

        double f = scenario.w1() * fracSinAsignar + scenario.w2() * fracSobrecapacidad + scenario.w3() * fracEspera;

        Map<String, Double> componentes = new HashMap<>();
        componentes.put("frac_sin_asignar", fracSinAsignar);
        componentes.put("frac_sobrecapacidad", fracSobrecapacidad);
        componentes.put("frac_espera", fracEspera);

        return new PlannerResult.ObjectiveFunctionResult(f, componentes, new java.util.ArrayList<>());
    }
}
