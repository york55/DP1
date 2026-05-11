package pe.pucp.tasfb2b.planner;

import lombok.Getter;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Consumer;

@Getter
public class SimulationContext {

    private final List<Airport> airports;
    private final List<Flight> flights;
    private final List<BaggageBatch> pendingBatches;
    private final LocalDateTime simulatedNow;
    private final AlnsParams alnsParams;
    private final Consumer<PlanProgressSnapshot> progressCallback;

    private SimulationContext(Builder builder) {
        this.airports = builder.airports;
        this.flights = builder.flights;
        this.pendingBatches = builder.pendingBatches;
        this.simulatedNow = builder.simulatedNow;
        this.alnsParams = builder.alnsParams;
        this.progressCallback = builder.progressCallback;
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

        public SimulationContext build() {
            return new SimulationContext(this);
        }
    }
}
