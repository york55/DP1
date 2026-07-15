package pe.pucp.tasfb2b.planner;

import lombok.Getter;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Getter
public class SimulationContext {

    /**
     * Posición real de un lote al momento de replanificar: el aeropuerto donde está
     * físicamente (destino de su último tramo COMPLETED, u origen si nunca voló) y la
     * hora mínima de salida de su próximo vuelo. Sin esto el optimizador replanifica
     * siempre desde el origen ORIGINAL del lote, generando rutas imposibles para lotes
     * que ya volaron parte de su ruta.
     */
    public record ReplanOrigin(String currentIata, LocalDateTime notBefore) {}

    private final List<Airport> airports;
    private final List<Flight> flights;
    private final List<BaggageBatch> pendingBatches;
    private final LocalDateTime simulatedNow;
    private final AlnsParams alnsParams;
    private final Consumer<PlanProgressSnapshot> progressCallback;
    // batchId → posición/hora desde la que hay que replanificar (solo en replan)
    private final Map<Long, ReplanOrigin> replanOrigins;
    // flightId → maletas ya comprometidas por tramos PENDING de lotes fuera de esta
    // corrida — sin esto el optimizador ve todos los vuelos SCHEDULED como vacíos
    private final Map<Long, Integer> flightBaseLoads;

    private SimulationContext(Builder builder) {
        this.airports = builder.airports;
        this.flights = builder.flights;
        this.pendingBatches = builder.pendingBatches;
        this.simulatedNow = builder.simulatedNow;
        this.alnsParams = builder.alnsParams;
        this.progressCallback = builder.progressCallback;
        this.replanOrigins = builder.replanOrigins;
        this.flightBaseLoads = builder.flightBaseLoads;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private List<Airport> airports;
        private List<Flight> flights;
        private List<BaggageBatch> pendingBatches;
        private LocalDateTime simulatedNow;
        private AlnsParams alnsParams = AlnsParams.defaults();
        private Consumer<PlanProgressSnapshot> progressCallback = null;
        private Map<Long, ReplanOrigin> replanOrigins = Collections.emptyMap();
        private Map<Long, Integer> flightBaseLoads = Collections.emptyMap();

        public Builder airports(List<Airport> airports) {
            this.airports = airports;
            return this;
        }

        public Builder flights(List<Flight> flights) {
            this.flights = flights;
            return this;
        }

        public Builder pendingBatches(List<BaggageBatch> pendingBatches) {
            this.pendingBatches = pendingBatches;
            return this;
        }

        public Builder simulatedNow(LocalDateTime simulatedNow) {
            this.simulatedNow = simulatedNow;
            return this;
        }

        public Builder alnsParams(AlnsParams alnsParams) {
            this.alnsParams = alnsParams;
            return this;
        }

        public Builder progressCallback(Consumer<PlanProgressSnapshot> progressCallback) {
            this.progressCallback = progressCallback;
            return this;
        }

        public Builder replanOrigins(Map<Long, ReplanOrigin> replanOrigins) {
            this.replanOrigins = replanOrigins != null ? replanOrigins : Collections.emptyMap();
            return this;
        }

        public Builder flightBaseLoads(Map<Long, Integer> flightBaseLoads) {
            this.flightBaseLoads = flightBaseLoads != null ? flightBaseLoads : Collections.emptyMap();
            return this;
        }

        public SimulationContext build() {
            return new SimulationContext(this);
        }
    }
}
