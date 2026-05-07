package pe.pucp.tasfb2b.simulation;

import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class SimulationClock {

    private LocalDateTime current;
    private final int tickDurationMinutes;
    private int tickCount;

    public SimulationClock(LocalDateTime start, int tickDurationMinutes) {
        this.current = start;
        this.tickDurationMinutes = tickDurationMinutes;
        this.tickCount = 0;
    }

    public LocalDateTime advance() {
        current = current.plusMinutes(tickDurationMinutes);
        tickCount++;
        return current;
    }

    public int getSimulatedDay() {
        return tickCount * tickDurationMinutes / (24 * 60) + 1;
    }
}
