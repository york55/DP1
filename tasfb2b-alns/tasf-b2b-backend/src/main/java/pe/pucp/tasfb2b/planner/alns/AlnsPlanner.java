package pe.pucp.tasfb2b.planner.alns;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.domain.Solution;
import pe.pucp.tasfb2b.planner.ObjectiveFunction;
import pe.pucp.tasfb2b.planner.Planner;
import pe.pucp.tasfb2b.planner.PlannerParams;
import pe.pucp.tasfb2b.planner.PlannerResult;
import pe.pucp.tasfb2b.planner.alns.operators.*;
import pe.pucp.tasfb2b.service.KpiCalculator;

import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class AlnsPlanner implements Planner {

    private static final Logger log = LoggerFactory.getLogger(AlnsPlanner.class);

    @Override
    public PlannerResult plan(Scenario scenario, PlannerParams p) {
        long startTime = System.currentTimeMillis();
        ThreadMXBean threadMXBean = ManagementFactory.getThreadMXBean();
        long cpuStart = threadMXBean.isCurrentThreadCpuTimeSupported() ? threadMXBean.getCurrentThreadCpuTime() : 0;
        Runtime rt = Runtime.getRuntime();
        long memStart = rt.totalMemory() - rt.freeMemory();
        AlnsParams params = p instanceof AlnsParams ? (AlnsParams) p : AlnsParams.defaultConfig();
        log.info("ALNS iniciado: nMax={}, qPct={}, t0={}, alpha={}, k={}", 
                params.nMax(), params.qPct(), params.t0(), params.alpha(), params.k());
        
        log.info("Construyendo solucion inicial (Greedy)...");
        Solution currentSol = GreedyInitializer.init(scenario);
        Solution bestSol = cloneSolution(currentSol);
        
        double currentF = ObjectiveFunction.evaluate(currentSol, scenario).valorFinal();
        double bestF = currentF;
        log.info("Solucion inicial: F={}", String.format("%.6f", currentF));

        List<DestroyOperator> destroyOps = List.of(
            new RouteRemoval(scenario.semillaAleatoria()),
            new RelatedRemoval(scenario.semillaAleatoria() + 1),
            new WorstRemoval(scenario.semillaAleatoria() + 2)
        );
        RepairOperator repairOp = new RegretKInsertion();
        
        AdaptiveSelector selector = new AdaptiveSelector(destroyOps, scenario.semillaAleatoria() + 3);
        SimulatedAnnealingAcceptor acceptor = new SimulatedAnnealingAcceptor(params.t0(), params.alpha(), scenario.semillaAleatoria() + 4);

        int q = (int) Math.max(1, scenario.envios().size() * params.qPct());
        log.info("Parametros calculados: q={} envios a remover por iteracion", q);
        
        List<PlannerResult.IterationHistory> history = new ArrayList<>();
        history.add(new PlannerResult.IterationHistory(0, currentF, bestF));

        for (int i = 1; i <= params.nMax(); i++) {
            if (i % 100 == 0) {
                long elapsed = System.currentTimeMillis() - startTime;
                log.info("  Iteracion {}/{} completada | elapsed={} ms", i, params.nMax(), elapsed);
            }
            Solution candidate = cloneSolution(currentSol);
            DestroyOperator selectedDestroy = selector.select();
            
            List<String> pool = selectedDestroy.destroy(candidate, scenario, params, q);
            repairOp.repair(candidate, pool, scenario, params);
            
            double candidateF = ObjectiveFunction.evaluate(candidate, scenario).valorFinal();
            
            double score = 0;
            if (acceptor.accept(currentF, candidateF)) {
                currentSol = candidate;
                currentF = candidateF;
                score = params.sigma2(); 
                
                if (candidateF < bestF) {
                    bestSol = cloneSolution(candidate);
                    bestF = candidateF;
                    score = params.sigma1(); 
                    log.debug("  Iteracion {}: NUEVA MEJOR F={} (op={})", i, String.format("%.6f", bestF), selectedDestroy.name());
                }
            }
            
            selector.updateScore(selectedDestroy, score);
            acceptor.coolDown();
            
            if (i % params.segLen() == 0) {
                selector.updateWeights(params.rho());
                history.add(new PlannerResult.IterationHistory(i, currentF, bestF));
                if (i % (params.segLen() * 10) == 0) {
                    log.info("  Progreso: iteracion {}/{} | F_actual={} | F_mejor={}", 
                            i, params.nMax(), String.format("%.6f", currentF), String.format("%.6f", bestF));
                }
            }
        }

        long executionTime = System.currentTimeMillis() - startTime;
        long cpuEnd = threadMXBean.isCurrentThreadCpuTimeSupported() ? threadMXBean.getCurrentThreadCpuTime() : 0;
        double cpuUsagePct = 0.0;
        if (cpuStart > 0 && cpuEnd > cpuStart && executionTime > 0) {
            cpuUsagePct = ((cpuEnd - cpuStart) / 1_000_000.0) / executionTime * 100.0;
        }
        
        long memEnd = rt.totalMemory() - rt.freeMemory();
        double ramPromedioMb = (memStart + memEnd) / 2.0 / (1024 * 1024);
        
        long totalDeliveryTimeMin = 0;
        for (var entry : bestSol.asignaciones().entrySet()) {
            var asig = entry.getValue();
            if (asig.estado() == pe.pucp.tasfb2b.domain.enums.ShipmentStatus.ASSIGNED) {
                var shipment = scenario.envios().stream()
                    .filter(s -> s.idEnvio().equals(asig.idEnvio()))
                    .findFirst().orElse(null);
                if (shipment != null && asig.horaEntregaEstimadaUtc() != null) {
                    totalDeliveryTimeMin += Duration.between(shipment.horaDisponibilidadUtc(), asig.horaEntregaEstimadaUtc()).toMinutes();
                }
            }
        }
        
        log.info("ALNS finalizado en {} ms | F_mejor={} | RAM_promedio={} MB | CPU={}%", executionTime, String.format("%.6f", bestF), String.format("%.2f", ramPromedioMb), String.format("%.1f", cpuUsagePct));
        
        var objRes = ObjectiveFunction.evaluate(bestSol, scenario);
        var finalObjResult = new PlannerResult.ObjectiveFunctionResult(objRes.valorFinal(), objRes.componentes(), history);
        
        int totalPedidos = scenario.envios().size();
        var metadata = new PlannerResult.Metadata("ALNS", scenario.semillaAleatoria(), scenario.periodoDias(), scenario.fechaInicioUtc().toString(), executionTime, params.nMax(), totalPedidos, ramPromedioMb, cpuUsagePct, totalDeliveryTimeMin);
        var kpis = KpiCalculator.calculate(bestSol, scenario);
        var asignaciones = new ArrayList<>(bestSol.asignaciones().values());

        log.info("KPIs: entregasATiempo={}%, enviosAsignados={}%, ocupacionVuelos={}%, maletasRetrasadas={}",
                String.format("%.1f", kpis.pctEntregasATiempo() * 100),
                String.format("%.1f", kpis.pctEnviosAsignados() * 100),
                String.format("%.1f", kpis.ocupacionPromedioVuelos() * 100),
                kpis.maletasRetrasadas());

        return new PlannerResult(metadata, finalObjResult, kpis, asignaciones);
    }

    private Solution cloneSolution(Solution sol) {
        Map<String, Solution.Assignment> newMap = new HashMap<>();
        for (var entry : sol.asignaciones().entrySet()) {
            var asig = entry.getValue();
            newMap.put(entry.getKey(), new Solution.Assignment(asig.idEnvio(), asig.estado(), asig.ruta(), asig.horaEntregaEstimadaUtc(), asig.retrasoMinutos()));
        }
        return new Solution(newMap);
    }

    @Override
    public String name() {
        return "ALNS";
    }
}
