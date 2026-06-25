package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.response.OpsReporteResponse;
import pe.pucp.tasfb2b.service.OpsReporteService;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/ops/reporte")
@RequiredArgsConstructor
public class OpsReporteController {

    private final OpsReporteService reporteService;

    /**
     * GET /ops/reporte/diario
     * Parámetro opcional: fecha=2026-06-25  (ISO, por defecto hoy)
     *
     * Ejemplo: GET /ops/reporte/diario?fecha=2026-06-25
     */
    @GetMapping("/diario")
    public ResponseEntity<OpsReporteResponse> getDailyReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fecha) {

        return ResponseEntity.ok(reporteService.buildDailyReport(fecha));
    }
}