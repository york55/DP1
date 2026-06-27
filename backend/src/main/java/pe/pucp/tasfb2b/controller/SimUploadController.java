package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.service.SimUploadService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sim/uploads")
@RequiredArgsConstructor
@Slf4j
public class SimUploadController {

    private final SimUploadService simUploadService;

    @PostMapping("/archivo")
    public ResponseEntity<Map<String, Object>> subir(@RequestParam("file") MultipartFile file) {
        log.info("ACTION sim_upload file='{}'", file.getOriginalFilename());
        try {
            simUploadService.guardar(file);
            return ResponseEntity.ok(Map.of(
                    "mensaje", "Archivo guardado correctamente",
                    "nombre", file.getOriginalFilename()
            ));
        } catch (Exception e) {
            log.error("Error guardando archivo: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/archivos")
    public ResponseEntity<List<String>> listar() {
        try {
            return ResponseEntity.ok(simUploadService.listar());
        } catch (Exception e) {
            log.error("Error listando archivos: {}", e.getMessage());
            return ResponseEntity.status(500).body(List.of());
        }
    }

    @DeleteMapping("/archivo/{nombre}")
    public ResponseEntity<Map<String, Object>> eliminar(@PathVariable String nombre) {
        log.info("ACTION sim_delete_upload file='{}'", nombre);
        try {
            simUploadService.eliminar(nombre);
            return ResponseEntity.ok(Map.of("mensaje", "Archivo eliminado", "nombre", nombre));
        } catch (Exception e) {
            log.error("Error eliminando archivo {}: {}", nombre, e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
