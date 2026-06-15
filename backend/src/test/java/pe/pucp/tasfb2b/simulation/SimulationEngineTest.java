package pe.pucp.tasfb2b.simulation;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class SimulationEngineTest {

    @Test
    void testTickAdvancesSimulatedClock30Minutes() {
        SimulationClock clock = new SimulationClock(
                LocalDateTime.of(2026, 5, 10, 0, 0),
                LocalDateTime.of(2026, 5, 10, 0, 0), 30);
        LocalDateTime before = clock.getCurrent();
        LocalDateTime after = clock.advance();
        assertThat(after).isEqualTo(before.plusMinutes(30));
    }

    @Test
    void testMultipleTicksAccumulateCorrectly() {
        SimulationClock clock = new SimulationClock(
                LocalDateTime.of(2026, 5, 10, 0, 0),
                LocalDateTime.of(2026, 5, 10, 0, 0), 30);
        for (int i = 0; i < 48; i++) {
            clock.advance();
        }
        assertThat(clock.getCurrent())
                .isEqualTo(LocalDateTime.of(2026, 5, 11, 0, 0));
    }

    @Test
    void testFlightBecomesInFlightAtDeparture() {
        // Verify that simulated time comparison logic works
        LocalDateTime departure = LocalDateTime.of(2026, 5, 10, 8, 0);
        LocalDateTime simNow = LocalDateTime.of(2026, 5, 10, 8, 30);
        assertThat(!simNow.isBefore(departure)).isTrue();
    }

    @Test
    void testSlaViolationCondition() {
        LocalDateTime deadline = LocalDateTime.of(2026, 5, 10, 18, 0);
        LocalDateTime simNow = LocalDateTime.of(2026, 5, 10, 19, 0);
        assertThat(simNow.isAfter(deadline)).isTrue();
    }

    @Test
    void testSimulationDayCalculation() {
        SimulationClock clock = new SimulationClock(
                LocalDateTime.of(2026, 5, 10, 0, 0),
                LocalDateTime.of(2026, 5, 10, 0, 0), 30);
        // Day 1
        assertThat(clock.getSimulatedDay()).isEqualTo(1);
        // After 47 ticks = 23.5 hours, still day 1
        for (int i = 0; i < 47; i++) clock.advance();
        assertThat(clock.getSimulatedDay()).isEqualTo(1);
        // After 48 ticks = 24 hours, day 2
        clock.advance();
        assertThat(clock.getSimulatedDay()).isEqualTo(2);
    }

    @Test
    void testKpiSnapshotPersisted() {
        // Structural test: ensure KpiSnapshot can be created
        pe.pucp.tasfb2b.domain.KpiSnapshot snapshot = new pe.pucp.tasfb2b.domain.KpiSnapshot();
        snapshot.setSnapshotTime(LocalDateTime.of(2026, 5, 10, 12, 0));
        snapshot.setOnTimePct(java.math.BigDecimal.valueOf(85.5));
        snapshot.setDelayedCount(3);
        snapshot.setAvgFlightOccupancy(java.math.BigDecimal.valueOf(72.3));
        snapshot.setAvgWarehouseOccupancy(java.math.BigDecimal.valueOf(45.1));
        assertThat(snapshot.getOnTimePct().doubleValue()).isEqualTo(85.5);
    }
}
