package pe.pucp.tasfb2b.controller;

import pe.pucp.tasfb2b.dto.request.EnvioRequest;
import pe.pucp.tasfb2b.service.EnvioService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/envios")
@CrossOrigin(origins = "*")
public class EnvioController {

    private final EnvioService envioService;

    public EnvioController(EnvioService envioService) {
        this.envioService = envioService;
    }

    /**
     * POST /api/envios/registrar
     * Body: { "almacenOrigen": "SKBO", "almacenDestino": "SEQM", "cantidadMaletas": "025" }
     */
    @PostMapping("/registrar")
    public ResponseEntity<?> registrarEnvio(@RequestBody EnvioRequest request) {

        if (request.getAlmacenOrigen() == null || request.getAlmacenOrigen().isBlank())
            return ResponseEntity.badRequest().body("El almacén origen es obligatorio.");
        if (request.getAlmacenDestino() == null || request.getAlmacenDestino().isBlank())
            return ResponseEntity.badRequest().body("El almacén destino es obligatorio.");
        if (request.getAlmacenOrigen().equals(request.getAlmacenDestino()))
            return ResponseEntity.badRequest().body("El almacén origen y destino no pueden ser iguales.");
        if (!request.getCantidadMaletas().matches("\\d{3}") || request.getCantidadMaletas().equals("000"))
            return ResponseEntity.badRequest().body("La cantidad de maletas debe ser entre 001 y 999.");

        try {
            String lineaRegistrada = envioService.registrarEnvio(
                    request.getAlmacenOrigen(),
                    request.getAlmacenDestino(),
                    request.getCantidadMaletas()
            );

            // idEnvio: primera parte de la línea (secuencial del archivo)
            // El externalId de BD (ENV-YYYYMMDD-XXXXXX) está en el log; si lo necesitas
            // en la respuesta, expón también un método getLastExternalId() en el service.
            String idEnvio = lineaRegistrada.split("-")[0];

            return ResponseEntity.ok(Map.of(
                    "mensaje",  "Envío registrado exitosamente.",
                    "idEnvio",  idEnvio,
                    "registro", lineaRegistrada
            ));

        } catch (IllegalArgumentException e) {
            // Aeropuerto no encontrado en BD
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body("Error al escribir el archivo de envíos: " + e.getMessage());
        }
    }
}