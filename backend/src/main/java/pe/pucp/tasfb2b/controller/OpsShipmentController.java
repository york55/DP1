package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.OpsShipmentRequest;
import pe.pucp.tasfb2b.dto.response.OpsShipmentResponse;
import pe.pucp.tasfb2b.service.OpsShipmentService;

import java.util.Map;

@RestController
@RequestMapping("/api/ops/shipments")
@RequiredArgsConstructor
public class OpsShipmentController {

    private final OpsShipmentService shipmentService;

    @PostMapping
    public ResponseEntity<?> register(@RequestBody OpsShipmentRequest req) {
        if (req.getAlmacenOrigen() == null || req.getAlmacenOrigen().isBlank())
            return ResponseEntity.badRequest().body("El almacén origen es obligatorio.");
        if (req.getAlmacenDestino() == null || req.getAlmacenDestino().isBlank())
            return ResponseEntity.badRequest().body("El almacén destino es obligatorio.");
        if (req.getAlmacenOrigen().equals(req.getAlmacenDestino()))
            return ResponseEntity.badRequest().body("Origen y destino no pueden ser iguales.");
        if (req.getCantidadMaletas() == null || !req.getCantidadMaletas().matches("\\d{1,3}")
                || Integer.parseInt(req.getCantidadMaletas()) < 1)
            return ResponseEntity.badRequest().body("La cantidad debe ser entre 1 y 999.");

        try {
            OpsShipmentResponse response = shipmentService.register(req);
            return ResponseEntity.ok(Map.of(
                "mensaje",   "Envío registrado exitosamente.",
                "idEnvio",   response.externalId(),
                "deadlineUtc", response.deadlineUtc().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}