package pe.pucp.tasfb2b.simulation;

import lombok.Getter;

import java.time.Duration;
import java.time.LocalDateTime;

@Getter
public class SimulationClock {

    private final LocalDateTime simStart;
    private LocalDateTime current;
    private final int tickDurationMinutes;
    private int tickCount;

    public SimulationClock(LocalDateTime simStart, LocalDateTime resumeFrom, int tickDurationMinutes) {
        this.simStart = simStart;
        this.current = resumeFrom;
        this.tickDurationMinutes = tickDurationMinutes;
        // Restore tickCount from elapsed simulated time so getSimulatedDay() is correct on reinit
        long minutesElapsed = Duration.between(simStart, resumeFrom).toMinutes();
        this.tickCount = (int) Math.max(0, minutesElapsed / tickDurationMinutes);
    }

    public LocalDateTime advance() {
        current = current.plusMinutes(tickDurationMinutes);
        tickCount++;
        return current;
    }

    /** Day number (1-based) derived from absolute elapsed simulated time, not tickCount. */
    public int getSimulatedDay() {
        long minutesElapsed = Duration.between(simStart, current).toMinutes();
        return (int) (minutesElapsed / (24 * 60)) + 1;
    }
}
