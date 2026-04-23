package pe.pucp.tasfb2b.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.Scenario;
import pe.pucp.tasfb2b.planner.Planner;
import pe.pucp.tasfb2b.planner.PlannerParams;
import pe.pucp.tasfb2b.planner.PlannerResult;
import pe.pucp.tasfb2b.service.ScenarioLoader;

import java.util.List;

@RestController
@RequestMapping("/api/planner")
@CrossOrigin(origins = "*")
public class PlannerController {

    private static final Logger log = LoggerFactory.getLogger(PlannerController.class);

    private final ScenarioLoader scenarioLoader;
    private final List<Planner> planners;

    public PlannerController(ScenarioLoader scenarioLoader, List<Planner> planners) {
        this.scenarioLoader = scenarioLoader;
        this.planners = planners;
        log.info("PlannerController inicializado con {} algoritmos: {}",
                planners.size(), planners.stream().map(Planner::name).toList());
    }

    @PostMapping("/execute")
    public ResponseEntity<?> execute(
            @RequestParam("aeropuertos") MultipartFile aeropuertosFile,
            @RequestParam("vuelos") MultipartFile vuelosFile,
            @RequestParam("envios") MultipartFile enviosFile,
            @RequestParam("parametros") MultipartFile parametrosFile,
            @RequestParam("algoritmo") String algoritmo,
            @RequestParam(value = "overrides", required = false) String overridesJson
    ) {
        log.info("========== NUEVA EJECUCION ==========");
        log.info("Algoritmo solicitado: {}", algoritmo);
        log.info("Archivos recibidos: aeropuertos={} ({} bytes), vuelos={} ({} bytes), envios={} ({} bytes), parametros={} ({} bytes)",
                aeropuertosFile.getOriginalFilename(), aeropuertosFile.getSize(),
                vuelosFile.getOriginalFilename(), vuelosFile.getSize(),
                enviosFile.getOriginalFilename(), enviosFile.getSize(),
                parametrosFile.getOriginalFilename(), parametrosFile.getSize());

        try {
            log.info("[1/3] Cargando escenario desde CSVs...");
            Scenario scenario = scenarioLoader.loadScenario(aeropuertosFile, vuelosFile, enviosFile, parametrosFile);
            log.info("[1/3] Escenario cargado: {} aeropuertos, {} vuelos, {} envios, periodo={} dias, semilla={}",
                    scenario.aeropuertos().size(), scenario.vuelos().size(), scenario.envios().size(),
                    scenario.periodoDias(), scenario.semillaAleatoria());

            log.info("[2/3] Seleccionando algoritmo '{}'...", algoritmo);
            Planner selectedPlanner = planners.stream()
                .filter(p -> p.name().equalsIgnoreCase(algoritmo))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Algoritmo no soportado: " + algoritmo));
            log.info("[2/3] Algoritmo seleccionado: {}", selectedPlanner.name());

            PlannerParams params = null;

            log.info("[3/3] Ejecutando planificacion...");
            long t0 = System.currentTimeMillis();
            PlannerResult result = selectedPlanner.plan(scenario, params);
            long elapsed = System.currentTimeMillis() - t0;
            log.info("[3/3] Planificacion completada en {} ms", elapsed);
            log.info("  Resultado: F={}, asignaciones={}, kpis.entregasATiempo={}%",
                    result.funcionObjetivo().valorFinal(),
                    result.asignaciones().size(),
                    String.format("%.1f", result.kpis().pctEntregasATiempo() * 100));
            log.info("========== FIN EJECUCION (OK) ==========");

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("========== ERROR EN EJECUCION ==========");
            log.error("Mensaje: {}", e.getMessage());
            log.error("Stacktrace completo:", e);
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
}
