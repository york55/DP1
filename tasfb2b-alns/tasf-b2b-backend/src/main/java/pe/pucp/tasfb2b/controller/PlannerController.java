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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@RestController
@RequestMapping("/api/planner")
@CrossOrigin(origins = "*")
public class PlannerController {

    private static final Logger log = LoggerFactory.getLogger(PlannerController.class);
    private static final Path RESULTS_DIR = Paths.get("results");
    private static final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private final ScenarioLoader scenarioLoader;
    private final List<Planner> planners;
    private final Map<String, ExecutionStatus> executions = new ConcurrentHashMap<>();

    public PlannerController(ScenarioLoader scenarioLoader, List<Planner> planners) {
        this.scenarioLoader = scenarioLoader;
        this.planners = planners;
        try { Files.createDirectories(RESULTS_DIR); } catch (IOException e) { /* ignore */ }
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
        String execId = java.util.UUID.randomUUID().toString();
        log.info("========== NUEVA EJECUCION {} ==========", execId);
        log.info("Algoritmo solicitado: {}", algoritmo);

        executions.put(execId, new ExecutionStatus(execId, "RUNNING", 0, 0, null));

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
            log.info("  Resultado: F={}, asignaciones={}, pedidosProcesados={}, kpis.entregasATiempo={}%",
                    result.funcionObjetivo().valorFinal(),
                    result.asignaciones().size(),
                    result.metadata().totalPedidosProcesados(),
                    String.format("%.1f", result.kpis().pctEntregasATiempo() * 100));

            Path resultPath = RESULTS_DIR.resolve(execId + ".json");
            mapper.writeValue(resultPath.toFile(), result);

            executions.put(execId, new ExecutionStatus(execId, "COMPLETED", result.metadata().totalPedidosProcesados(), elapsed, resultPath.toString()));
            log.info("========== FIN EJECUCION {} (OK) ==========", execId);

            Map<String, Object> response = new HashMap<>();
            response.put("execId", execId);
            response.put("status", "COMPLETED");
            response.put("pedidosProcesados", result.metadata().totalPedidosProcesados());
            response.put("asignaciones", result.asignaciones().size());
            response.put("entregasATiempo", result.kpis().pctEntregasATiempo() * 100);
            response.put("enviosAsignados", result.kpis().pctEnviosAsignados() * 100);
            response.put("ocupacionVuelos", result.kpis().ocupacionPromedioVuelos() * 100);
            response.put("maletasRetrasadas", result.kpis().maletasRetrasadas());
            response.put("funcionObjetivo", result.funcionObjetivo().valorFinal());
            response.put("tiempoEjecucionMs", elapsed);
            response.put("metadata", result.metadata());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("========== ERROR EN EJECUCION {} ==========", execId);
            log.error("Mensaje: {}", e.getMessage());
            log.error("Stacktrace completo:", e);
            executions.put(execId, new ExecutionStatus(execId, "FAILED", 0, 0, e.getMessage()));
            return ResponseEntity.badRequest().body(Map.of("execId", execId, "status", "FAILED", "error", e.getMessage()));
        }
    }

    @GetMapping("/result/{execId}")
    public ResponseEntity<?> getResult(@PathVariable String execId) {
        ExecutionStatus status = executions.get(execId);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }
        if ("COMPLETED".equals(status.status())) {
            try {
                Path resultPath = Paths.get(status.resultPath());
                if (Files.exists(resultPath)) {
                    String json = Files.readString(resultPath);
                    return ResponseEntity.ok().header("Content-Type", "application/json").body(json);
                }
            } catch (IOException e) {
                return ResponseEntity.internalServerError().body("Error reading result file");
            }
        }
        return ResponseEntity.ok(status);
    }

    @GetMapping("/status/{execId}")
    public ResponseEntity<?> getStatus(@PathVariable String execId) {
        ExecutionStatus status = executions.get(execId);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }

    public record ExecutionStatus(String execId, String status, int pedidosProcesados, long tiempoMs, String resultPath) {}
}
