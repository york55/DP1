package pe.pucp.tasfb2b.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ClpCreateSimulationRequest {

    @NotNull
    private LocalDateTime startDate;

    @NotBlank
    private String algorithm = "ALNS";

    @DecimalMin("0.0") @DecimalMax("100.0")
    private Double cancellationRate = 10.0;

    @NotNull
    private Long seed;

    @Positive
    private int volumePerDay = 10;

    private AlnsParamsRequest alnsParams;

    @Data
    public static class AlnsParamsRequest {
        private Double t0;
        private Double alpha;
        private Double qPct;
        private Integer maxIterations;
    }
}
