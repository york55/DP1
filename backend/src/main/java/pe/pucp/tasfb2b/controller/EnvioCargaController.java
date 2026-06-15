package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.dto.response.EnvioStoreStatus;
import pe.pucp.tasfb2b.service.EnvioCargaService;
import pe.pucp.tasfb2b.simulation.EnvioStore;

import java.util.Map;

@RestController
@RequestMapping("/api/envios")
@RequiredArgsConstructor
@Slf4j
public class EnvioCargaController {

    private final EnvioCargaService envioCargaService;
    private final EnvioStore envioStore;

    @PostMapping("/cargar")
    public ResponseEntity<Map<String, Object>> cargar(@RequestParam("file") MultipartFile file) {
        log.info("ACTION cargar_envio file='{}'", file.getOriginalFilename());
        try {
            byte[] bytes = file.getBytes();
            envioCargaService.cargarArchivoAsync(bytes, file.getOriginalFilename());
            return ResponseEntity.accepted().body(Map.of("mensaje", "Carga iniciada"));
        } catch (Exception e) {
            log.error("Error recibiendo archivo: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/estado")
    public ResponseEntity<EnvioStoreStatus> estado() {
        return ResponseEntity.ok(new EnvioStoreStatus(
                envioStore.isLoaded(),
                envioStore.getTotalCount(),
                envioStore.getMinDate(),
                envioStore.getMaxDate()
        ));
    }

    @DeleteMapping("/limpiar")
    public ResponseEntity<Map<String, Object>> limpiar() {
        envioStore.clear();
        log.info("ACTION limpiar_envios - store vaciado");
        return ResponseEntity.ok(Map.of("mensaje", "Store de envíos vaciado"));
    }
}
