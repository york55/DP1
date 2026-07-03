package pe.pucp.tasfb2b.websocket;

import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.dto.response.SimulationTickEvent;
import pe.pucp.tasfb2b.planner.PlanProgressSnapshot;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishTick(Long simulationId, SimulationTickEvent event) {
        String destination = "/topic/simulation/" + simulationId + "/tick";
        log.debug("Publicando tick para simulación {} en {}", simulationId, destination);
        messagingTemplate.convertAndSend(destination, event);
    }

    public void publishPlanProgress(Long simulationId, PlanProgressSnapshot snapshot) {
        String destination = "/topic/simulation/" + simulationId + "/plan-progress";
        messagingTemplate.convertAndSend(destination, snapshot);
    }

    /**
     * Tick "keep-alive" liviano, publicado mientras el orquestador espera a que
     * termine la planificación en background del siguiente bloque. No trae datos
     * de simulación (el frontend no debe pisar su estado con esto), solo evita que
     * el topic /tick quede mudo por muchos segundos seguidos mientras el ALNS corre.
     */
    public void publishWaitingForPlan(Long simulationId, int blockIndex) {
        String destination = "/topic/simulation/" + simulationId + "/plan-progress";
        var payload = new PlanProgressSnapshot(
                "WAITING", 0, 0, 0, 0, 0.0,
                blockIndex, -1, "", "");
        messagingTemplate.convertAndSend(destination, payload);
    }

    /** Fin normal de simulación (sin colapso). */
    public void publishFinished(Long simulationId) {
        publishFinished(simulationId, false, null);
    }

    /**
     * Fin de simulación. Si fue por colapso, manda simulationStatus="COLLAPSED"
     * y el IATA del aeropuerto colapsado, que es lo que useClpSimulation.js espera
     * (antes siempre mandaba "FINISHED" y nunca incluía el aeropuerto, así que el
     * frontend nunca detectaba el colapso por WebSocket).
     */
    public void publishFinished(Long simulationId, boolean collapsed, String collapsedAirportIata) {
        String destination = "/topic/simulation/" + simulationId + "/tick";
        var event = pe.pucp.tasfb2b.dto.response.SimulationTickEvent.builder()
                .simulationId(simulationId)
                .simulationStatus(collapsed ? "COLLAPSED" : "FINISHED")
                .collapsedIata(collapsedAirportIata)
                .build();
        messagingTemplate.convertAndSend(destination, event);
        log.info("Publicado evento {} para simulación {}{}",
                collapsed ? "COLLAPSED" : "FINISHED", simulationId,
                collapsed ? " (aeropuerto=" + collapsedAirportIata + ")" : "");
    }

    /** Alertas scopeadas por simulación, para que dos simulaciones corriendo a la
     *  vez (una de 5 días y una de colapso, o dos colapsos) no se crucen eventos. */
    public void publishAlert(Long simulationId, AlertEvent event) {
        messagingTemplate.convertAndSend("/topic/simulation/" + simulationId + "/alerts", event);
    }

    public void publishBlockStart(Long simulationId, int blockIndex, int totalBlocks,
                                   LocalDateTime blockWindowStart, LocalDateTime blockWindowEnd) {
        String destination = "/topic/simulation/" + simulationId + "/plan-progress";
        var payload = new PlanProgressSnapshot(
                "BLOCK_START", 0, totalBlocks, blockIndex, totalBlocks, 0.0,
                blockIndex, totalBlocks,
                blockWindowStart.toString(), blockWindowEnd.toString());
        messagingTemplate.convertAndSend(destination, payload);
    }

    public record AlertEvent(
            String type,
            Long shipmentId,
            Long flightId,
            String airportIata,
            String message,
            String simulatedTime
    ) {}
}