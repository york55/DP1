package pe.pucp.tasfb2b.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateSimulationRequest {

    @NotNull
    private String scenarioType;

    @Min(3) @Max(7)
    private Integer periodDays;

    @NotNull
    private LocalDateTime startDate;

    @NotBlank
    private String algorithm = "ALNS";

    @DecimalMin("0.0") @DecimalMax("100.0")
    private Double cancellationRate = 0.0;

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
        private Integer segLen;
        private Double sigma1;
        private Double sigma2;
        private Double sigma3;
        private Double rho;
        private Double pNoise;
        private Double w1;
        private Double w2;
        private Double w3;
        private Integer kRegret;
    }
}
