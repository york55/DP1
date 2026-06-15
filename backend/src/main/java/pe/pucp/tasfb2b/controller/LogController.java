package pe.pucp.tasfb2b.controller;

import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.config.LogBuffer;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/logs")
@CrossOrigin(origins = "*")
public class LogController {

    private static final Logger frontendLogger = LoggerFactory.getLogger("frontend-logger");

    @PostMapping
    public ResponseEntity<Void> receiveLog(@RequestBody LogRequest request) {
        String ctx = request.getContext() != null ? request.getContext() : "FRONTEND";
        String message = String.format("[%s] %s", ctx, request.getMessage());

        switch (request.getLevel().toUpperCase()) {
            case "ERROR" -> frontendLogger.error(message);
            case "WARN", "WARNING" -> frontendLogger.warn(message);
            case "DEBUG" -> frontendLogger.debug(message);
            default -> frontendLogger.info(message);
        }

        LogBuffer buf = LogBuffer.getInstance();
        if (buf != null) {
            buf.addFrontend(request.getLevel(), ctx, request.getMessage());
        }

        return ResponseEntity.ok().build();
    }

    @GetMapping("/recent")
    public ResponseEntity<Map<String, List<LogBuffer.LogEntry>>> getRecent(
            @RequestParam(defaultValue = "200") int limit) {
        LogBuffer buf = LogBuffer.getInstance();
        if (buf == null) {
            return ResponseEntity.ok(Map.of("backend", List.of(), "frontend", List.of()));
        }
        return ResponseEntity.ok(Map.of(
            "backend",  buf.getBackend(limit),
            "frontend", buf.getFrontend(limit)
        ));
    }

    @Data
    public static class LogRequest {
        private String level;
        private String message;
        private String context;
    }
}
