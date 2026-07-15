package pe.pucp.tasfb2b.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import pe.pucp.tasfb2b.dto.response.ErrorResponse;

import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(SimulationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSimulationNotFound(SimulationNotFoundException ex,
                                                                   HttpServletRequest req) {
        log.warn("Simulación no encontrada: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.builder()
                        .code("SIMULATION_NOT_FOUND")
                        .message(ex.getMessage())
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    @ExceptionHandler(CapacityExceededException.class)
    public ResponseEntity<ErrorResponse> handleCapacityExceeded(CapacityExceededException ex,
                                                                 HttpServletRequest req) {
        log.warn("Capacidad excedida: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.builder()
                        .code("CAPACITY_EXCEEDED")
                        .message(ex.getMessage())
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    @ExceptionHandler(PlanningException.class)
    public ResponseEntity<ErrorResponse> handlePlanningException(PlanningException ex,
                                                                   HttpServletRequest req) {
        log.error("Error de planificación: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.builder()
                        .code("PLANNING_ERROR")
                        .message(ex.getMessage())
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                           HttpServletRequest req) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.builder()
                        .code("VALIDATION_ERROR")
                        .message(message)
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex,
                                                                HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.builder()
                        .code("INVALID_REQUEST")
                        .message(ex.getMessage())
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    // Reglas de negocio violadas (p. ej. cancelar un vuelo que ya no está SCHEDULED,
    // o la regla <1h sin instancia siguiente): conflicto con el estado actual, no un 500.
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex,
                                                             HttpServletRequest req) {
        log.warn("Conflicto de estado: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.builder()
                        .code("STATE_CONFLICT")
                        .message(ex.getMessage())
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    // Choque de escritura concurrente (bloqueo optimista): otro hilo — típicamente un
    // tick de la simulación — modificó la entidad primero. Reintentable por el cliente.
    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(
            org.springframework.orm.ObjectOptimisticLockingFailureException ex,
            HttpServletRequest req) {
        log.warn("Conflicto de concurrencia: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.builder()
                        .code("CONCURRENT_MODIFICATION")
                        .message("El vuelo fue modificado por la simulación en este instante. Intenta de nuevo.")
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex, HttpServletRequest req) {
        log.error("Error interno: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.builder()
                        .code("INTERNAL_ERROR")
                        .message("Error interno del servidor")
                        .timestamp(Instant.now())
                        .path(req.getRequestURI())
                        .build());
    }
}
