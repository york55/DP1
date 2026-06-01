package pe.pucp.tasfb2b.websocket;

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

    public void publishAlert(Long simulationId, AlertEvent event) {
        messagingTemplate.convertAndSend("/topic/alerts", event);
    }

    public void publishBlockStart(Long simulationId, int blockIndex, int totalBlocks) {
        String destination = "/topic/simulation/" + simulationId + "/plan-progress";
        // Reuse plan-progress channel with BLOCK_START phase so the frontend knows which day is being planned
        var payload = new pe.pucp.tasfb2b.planner.PlanProgressSnapshot(
                "BLOCK_START", 0, totalBlocks, blockIndex, totalBlocks, 0.0);
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
