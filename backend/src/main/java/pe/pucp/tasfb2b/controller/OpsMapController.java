package pe.pucp.tasfb2b.controller;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.OpsMapResponse;
import pe.pucp.tasfb2b.service.OpsFlightCancelService;
import pe.pucp.tasfb2b.service.OpsMapService;
import pe.pucp.tasfb2b.service.OpsPlannerService;

import java.util.Map;

@RestController
@RequestMapping("/api/ops/map")
@RequiredArgsConstructor
@Slf4j
public class OpsMapController {

    private final OpsMapService          mapService;
    private final OpsPlannerService       plannerService;
    private final OpsFlightCancelService  cancelService; // ── AGREGADO

    /**
     * GET /api/ops/map/snapshot
     * El frontend llama esto periódicamente (ej. cada 30 s) para actualizar el mapa.
     */
    @GetMapping("/snapshot")
    public ResponseEntity<OpsMapResponse> snapshot() {
        return ResponseEntity.ok(mapService.buildSnapshot());
    }

    /**
     * POST /api/ops/map/trigger-planning
     * Endpoint manual para forzar un ciclo de planificación sin esperar el scheduler.
     * Útil para pruebas o para el botón "Planificar ahora" en el front si se necesita.
     */
    @PostMapping("/trigger-planning")
    public ResponseEntity<Void> triggerPlanning() {
        log.info("OpsMapController: planificación manual disparada");
        plannerService.runPlanning();
        return ResponseEntity.ok().build();
    }

    /**
     * PATCH /api/ops/map/flights/{id}/cancel
     * AGREGADO: cancelación directa desde el panel de vuelos del mapa de Operaciones.
     * {id} es el id de la instancia (OPS_FLIGHT) que ya se ve en el snapshot, no el
     * del plan — se resuelve internamente y se reusa la misma regla de 60 min /
     * liberación de envíos que usa el módulo de "Cancelación de vuelos".
     */
    @PatchMapping("/flights/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelFlight(@PathVariable Long id) {
        try {
            OpsFlightCancelService.CancelResult result = cancelService.cancelByFlightInstanceId(id);
            log.info("OpsMapController: cancelFlight instancia={} → {} : {}",
                    id, result.type(), result.message());

            Map<String, Object> body = new java.util.HashMap<>();
            body.put("status", result.type().name());
            body.put("targetDate", result.targetDate() != null ? result.targetDate().toString() : null);
            body.put("shipmentsReleased", result.shipmentsReleased());
            body.put("message", result.message());
            return ResponseEntity.ok(body);
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }
}