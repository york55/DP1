package pe.pucp.tasfb2b.controller;

import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/logs")
@CrossOrigin(origins = "*")
public class LogController {

    private static final Logger frontendLogger = LoggerFactory.getLogger("frontend-logger");

    @PostMapping
    public ResponseEntity<Void> receiveLog(@RequestBody LogRequest request) {
        String message = String.format("[%s] %s", request.getContext() != null ? request.getContext() : "FRONTEND", request.getMessage());
        
        switch (request.getLevel().toUpperCase()) {
            case "ERROR":
                frontendLogger.error(message);
                break;
            case "WARN":
            case "WARNING":
                frontendLogger.warn(message);
                break;
            case "DEBUG":
                frontendLogger.debug(message);
                break;
            case "INFO":
            default:
                frontendLogger.info(message);
                break;
        }
        return ResponseEntity.ok().build();
    }

    @Data
    public static class LogRequest {
        private String level;
        private String message;
        private String context;
    }
}
