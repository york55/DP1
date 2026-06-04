package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.domain.ActiveFlight;
import pe.pucp.tasfb2b.dto.response.ActiveFlightResponse;
import pe.pucp.tasfb2b.service.DayStateService;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/flight-ops")
@RequiredArgsConstructor
public class FlightOperationsController {

    private final DayStateService dayStateService;

    @GetMapping
    public ResponseEntity<List<ActiveFlightResponse>> getAll() {
        List<ActiveFlightResponse> response = dayStateService.getVuelosActivos().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{flightKey}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable String flightKey) {
        boolean cancelled = dayStateService.cancelFlight(flightKey);
        return cancelled ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    private ActiveFlightResponse toResponse(ActiveFlight f) {
        return new ActiveFlightResponse(
            f.getFlightKey(),
            f.getOrigin(),
            f.getDestination(),
            dayStateService.toUtc(f.getOrigin(), f.getDepartureLocal()).toString(),
            dayStateService.toUtc(f.getDestination(), f.getArrivalLocal()).toString(),
            f.getDepartureLocal().toString(),
            f.getArrivalLocal().toString(),
            f.getCapacity(),
            f.isCancelled()
        );
    }
	
	@GetMapping("/debug/state")
	public ResponseEntity<Map<String, Object>> debugState() {
		Map<String, Object> state = new HashMap<>();
		state.put("vuelosActivos", dayStateService.getVuelosActivos().stream()
				.map(f -> Map.of(
					"flightKey", f.getFlightKey(),
					"cancelled", f.isCancelled()
				))
				.toList());
		state.put("enviosPorEnviar", dayStateService.getEnviosPorEnviar());
		state.put("totalVuelos", dayStateService.getVuelosActivos().size());
		state.put("totalEnvios", dayStateService.getEnviosPorEnviar().size());
		return ResponseEntity.ok(state);
	}
}