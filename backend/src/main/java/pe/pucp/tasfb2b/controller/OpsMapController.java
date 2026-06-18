package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.OpsMapResponse;
import pe.pucp.tasfb2b.service.OpsMapService;
import pe.pucp.tasfb2b.service.OpsPlannerService;

@RestController
@RequestMapping("/api/ops/map")
@RequiredArgsConstructor
@Slf4j
public class OpsMapController {

    private final OpsMapService     mapService;
    private final OpsPlannerService plannerService;

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
}
