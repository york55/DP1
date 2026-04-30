package pe.pucp.tasfb2b.planner;

import java.util.List;
import java.util.Map;
import pe.pucp.tasfb2b.domain.Solution.Assignment;

public record PlannerResult(
    Metadata metadata,
    ObjectiveFunctionResult funcionObjetivo,
    Kpis kpis,
    List<Assignment> asignaciones
) {
    public record Metadata(
        String algoritmo,
        long semilla,
        int periodoDias,
        String fechaInicioUtc,
        long tiempoEjecucionMs,
        int numeroIteraciones,
        int totalPedidosProcesados,
        double ramPromedioMb,
        double cpuUsagePct,
        long totalDeliveryTimeMin
    ) {}

    public record ObjectiveFunctionResult(
        double valorFinal,
        Map<String, Double> componentes,
        List<IterationHistory> historicoPorIteracion
    ) {}

    public record IterationHistory(
        int iteracion,
        double fActual,
        double fMejor
    ) {}

    public record Kpis(
        double pctEntregasATiempo,
        double pctEnviosAsignados,
        double ocupacionPromedioVuelos,
        double ocupacionPromedioAlmacenes,
        int maletasRetrasadas
    ) {}
}
