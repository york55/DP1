# Opción B: Refactorización Asíncrona del Backend ALNS

## Objetivo

Rediseñar la comunicación entre el script de extracción (cliente Node.js) y el backend Spring Boot para que el procesamiento del algoritmo ALNS sea asíncrono. El servidor notifica al cliente cuando termina, en lugar de mantener la conexión HTTP abierta durante todo el cálculo.

## Problema Actual

El endpoint `POST /api/planner/execute` en `PlannerController.java` es **síncrono**: recibe los CSVs, ejecuta el algoritmo ALNS completo (1500 iteraciones sobre 431+ pedidos), y recién entonces retorna el JSON con los resultados. El cliente debe esperar en silencio todo ese tiempo, lo que causa timeouts.

## Arquitectura Propuesta

```
┌─────────────┐      POST /execute       ┌──────────────┐
│  Script      │ ───────────────────────► │  Controller  │
│  (Node.js)   │ ◄─── 202 Accepted ───── │  (Spring)    │
│              │      + jobId             │              │
└─────┬───────┘                          └──────┬───────┘
      │                                         │
      │  GET /status/{jobId}                     │  Lanza tarea
      │  (polling cada N seg)                    │  en background
      │                                         ▼
      │                                  ┌──────────────┐
      │                                  │  AsyncService │
      │  ◄─── 200 + resultados ────────  │  (Thread Pool)│
      │  (cuando status = COMPLETED)     └──────────────┘
```

## Cambios Necesarios en el Backend (Java)

### 1. Nuevo record `JobStatus`

```java
// pe.pucp.tasfb2b.planner.JobStatus.java
public record JobStatus(
    String jobId,
    String status,        // QUEUED, RUNNING, COMPLETED, FAILED
    int progressPct,
    PlannerResult result   // null hasta que termine
) {}
```

### 2. Servicio asíncrono `PlannerAsyncService`

```java
@Service
public class PlannerAsyncService {
    private final ConcurrentHashMap<String, JobStatus> jobs = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public String submitJob(Scenario scenario, Planner planner, PlannerParams params) {
        String jobId = UUID.randomUUID().toString();
        jobs.put(jobId, new JobStatus(jobId, "QUEUED", 0, null));

        executor.submit(() -> {
            jobs.put(jobId, new JobStatus(jobId, "RUNNING", 0, null));
            try {
                PlannerResult result = planner.plan(scenario, params);
                jobs.put(jobId, new JobStatus(jobId, "COMPLETED", 100, result));
            } catch (Exception e) {
                jobs.put(jobId, new JobStatus(jobId, "FAILED", 0, null));
            }
        });

        return jobId;
    }

    public JobStatus getStatus(String jobId) {
        return jobs.get(jobId);
    }
}
```

### 3. Nuevos endpoints en `PlannerController`

```java
// POST /api/planner/execute-async → 202 Accepted + { "jobId": "..." }
@PostMapping("/execute-async")
public ResponseEntity<?> executeAsync(...) {
    Scenario scenario = scenarioLoader.loadScenario(...);
    String jobId = asyncService.submitJob(scenario, selectedPlanner, params);
    return ResponseEntity.accepted().body(Map.of("jobId", jobId));
}

// GET /api/planner/status/{jobId} → { status, progressPct, result }
@GetMapping("/status/{jobId}")
public ResponseEntity<?> getStatus(@PathVariable String jobId) {
    JobStatus status = asyncService.getStatus(jobId);
    if (status == null) return ResponseEntity.notFound().build();
    return ResponseEntity.ok(status);
}
```

## Cambios Necesarios en el Script (Node.js)

```javascript
// 1. Enviar datos al endpoint async
const submitRes = await fetch('http://localhost:8080/api/planner/execute-async', { method: 'POST', body: form });
const { jobId } = await submitRes.json();

// 2. Polling hasta que termine
let status;
do {
    await new Promise(r => setTimeout(r, 3000)); // esperar 3 seg
    const pollRes = await fetch(`http://localhost:8080/api/planner/status/${jobId}`);
    status = await pollRes.json();
    console.log(`  Progreso: ${status.progressPct}% (${status.status})`);
} while (status.status !== 'COMPLETED' && status.status !== 'FAILED');

// 3. Procesar resultados
console.log(status.result);
```

## Mejora Avanzada: WebSockets (Opcional)

En lugar de polling, se puede usar **WebSockets** para que el servidor notifique al cliente en tiempo real:

- Dependencia: `spring-boot-starter-websocket`
- El cliente abre un canal WebSocket y recibe actualizaciones de progreso por iteración
- Elimina completamente la necesidad de polling

## Archivos a Modificar

| Archivo | Acción |
| --- | --- |
| `PlannerController.java` | Agregar endpoints `/execute-async` y `/status/{jobId}` |
| `PlannerAsyncService.java` | **Nuevo archivo** - Servicio de ejecución en background |
| `JobStatus.java` | **Nuevo archivo** - Record para el estado del job |
| `extract_day1.cjs` | Adaptar al flujo de submit + polling |

## Estimación de Esfuerzo

| Tarea | Tiempo Estimado |
| --- | --- |
| Backend (3 archivos) | ~2-3 horas |
| Frontend (1 archivo) | ~1 hora |
| Testing | ~1 hora |
| **Total** | **~4-5 horas** |
