package pe.pucp.tasfb2b.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AirportRequest {

    @NotBlank(message = "El código IATA es obligatorio")
    @Size(min = 3, max = 4, message = "El código IATA debe tener entre 3 y 4 caracteres")
    private String iataCode;

    @NotBlank(message = "La ciudad es obligatoria")
    @Size(max = 120, message = "La ciudad no puede exceder 120 caracteres")
    private String city;

    @NotBlank(message = "El país es obligatorio")
    @Size(max = 80, message = "El país no puede exceder 80 caracteres")
    private String country;

    @NotBlank(message = "El continente es obligatorio")
    @Size(max = 20, message = "El continente no puede exceder 20 caracteres")
    private String continent;

    @Min(value = 1, message = "La capacidad del almacén debe ser al menos 1")
    private int warehouseCapacity;

    private int gmtOffset;

    @NotNull(message = "La latitud es obligatoria")
    @DecimalMin(value = "-90.0", message = "La latitud debe ser >= -90")
    @DecimalMax(value = "90.0", message = "La latitud debe ser <= 90")
    private BigDecimal latitude;

    @NotNull(message = "La longitud es obligatoria")
    @DecimalMin(value = "-180.0", message = "La longitud debe ser >= -180")
    @DecimalMax(value = "180.0", message = "La longitud debe ser <= 180")
    private BigDecimal longitude;
}
