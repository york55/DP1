package pe.pucp.tasfb2b.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FlightRequest {

    @NotBlank(message = "El aeropuerto de origen es obligatorio")
    @Size(min = 3, max = 4, message = "El código IATA de origen debe tener entre 3 y 4 caracteres")
    private String originIata;

    @NotBlank(message = "El aeropuerto de destino es obligatorio")
    @Size(min = 3, max = 4, message = "El código IATA de destino debe tener entre 3 y 4 caracteres")
    private String destinationIata;

    @NotNull(message = "La hora de salida es obligatoria")
    private LocalDateTime departureTime;

    @NotNull(message = "La hora de llegada es obligatoria")
    private LocalDateTime arrivalTime;

    @Min(value = 1, message = "La capacidad de equipaje debe ser al menos 1")
    private int baggageCapacity;

    @NotBlank(message = "La frecuencia es obligatoria")
    private String frequency;

    private String status;
}
