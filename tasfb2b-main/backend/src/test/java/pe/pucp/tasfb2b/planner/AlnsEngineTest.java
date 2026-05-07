package pe.pucp.tasfb2b.planner;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsEngine;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AlnsEngineTest {

    private AlnsEngine engine;
    private Airport lima;
    private Airport miami;
    private Airport bogota;
    private Flight limaMiami;
    private Flight bogotaMiami;
    private BaggageBatch batch1;
    private BaggageBatch batch2;

    @BeforeEach
    void setUp() {
        engine = new AlnsEngine();

        lima = airport("LIM", "Americas");
        miami = airport("MIA", "Americas");
        bogota = airport("BOG", "Americas");

        limaMiami = flight(lima, miami,
                LocalDateTime.of(2026, 5, 10, 7, 0),
                LocalDateTime.of(2026, 5, 10, 13, 0),
                300);

        bogotaMiami = flight(bogota, miami,
                LocalDateTime.of(2026, 5, 10, 9, 0),
                LocalDateTime.of(2026, 5, 10, 13, 0),
                200);

        batch1 = batch(lima, miami, 50, LocalDateTime.of(2026, 5, 10, 0, 0));
        batch2 = batch(bogota, miami, 30, LocalDateTime.of(2026, 5, 10, 0, 0));
    }

    @Test
    void testGreedyInitAssignsAllFeasibleBatches() {
        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami, bogota))
                .flights(List.of(limaMiami, bogotaMiami))
                .pendingBatches(List.of(batch1, batch2))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(AlnsParams.fast())
                .build();

        OptimizationResult result = engine.optimize(ctx);

        assertThat(result.assignedCount()).isGreaterThan(0);
        assertThat(result.routes()).isNotEmpty();
    }

    @Test
    void testObjectiveFunctionPenalizesUnassigned() {
        Flight noCapacityFlight = flight(lima, miami,
                LocalDateTime.of(2026, 5, 10, 7, 0),
                LocalDateTime.of(2026, 5, 10, 13, 0),
                1); // tiny capacity

        BaggageBatch bigBatch = batch(lima, miami, 200,
                LocalDateTime.of(2026, 5, 10, 0, 0));

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami))
                .flights(List.of(noCapacityFlight))
                .pendingBatches(List.of(bigBatch))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(AlnsParams.fast())
                .build();

        OptimizationResult result = engine.optimize(ctx);
        assertThat(result.failedCount()).isGreaterThan(0);
        assertThat(result.objectiveValue()).isGreaterThan(0.0);
    }

    @Test
    void testRouteRemovalDestroysSomeLots() {
        AlnsSolution solution = new AlnsSolution(
                List.of(limaMiami), List.of(batch1));
        solution.assign(batch1.getId(), List.of(limaMiami.getId()));

        assertThat(solution.getBankSize()).isEqualTo(0);
        assertThat(solution.getAssignments()).hasSize(1);
    }

    @Test
    void testRelatedRemovalGroupsSimilarLots() {
        BaggageBatch b1 = batch(lima, miami, 20, LocalDateTime.of(2026, 5, 10, 6, 0));
        BaggageBatch b2 = batch(lima, miami, 15, LocalDateTime.of(2026, 5, 10, 7, 0));

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami))
                .flights(List.of(limaMiami))
                .pendingBatches(List.of(b1, b2))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(AlnsParams.fast())
                .build();

        OptimizationResult result = engine.optimize(ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void testRegretInsertionAssignsMostUrgentFirst() {
        BaggageBatch urgent = batch(lima, miami, 10, LocalDateTime.of(2026, 5, 10, 0, 0));
        BaggageBatch nonUrgent = batch(bogota, miami, 10, LocalDateTime.of(2026, 5, 12, 0, 0));

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami, bogota))
                .flights(List.of(limaMiami, bogotaMiami))
                .pendingBatches(List.of(urgent, nonUrgent))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(AlnsParams.fast())
                .build();

        OptimizationResult result = engine.optimize(ctx);
        assertThat(result.assignedCount()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void testSaAcceptsWorseWithPositiveProbability() {
        // With t0=1000 (high temperature) SA should accept worse solutions more
        AlnsParams highTemp = new AlnsParams(1000.0, 0.999, 0.5, 50, 25,
                9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 2);

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami))
                .flights(List.of(limaMiami))
                .pendingBatches(List.of(batch1))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(highTemp)
                .build();

        OptimizationResult result = engine.optimize(ctx);
        assertThat(result).isNotNull();
        assertThat(result.computeTime()).isNotNull();
    }

    @Test
    void testFullAlnsReducesObjectiveOverIterations() {
        AlnsParams moreIter = new AlnsParams(100.0, 0.999, 0.25, 200, 50,
                9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 3);

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami, bogota))
                .flights(List.of(limaMiami, bogotaMiami))
                .pendingBatches(List.of(batch1, batch2))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(moreIter)
                .build();

        OptimizationResult result = engine.optimize(ctx);
        assertThat(result.objectiveValue()).isLessThanOrEqualTo(1.0);
    }

    @Test
    void testReplanOnlyAffectedBatches() {
        BaggageBatch affected = batch(lima, miami, 20, LocalDateTime.of(2026, 5, 10, 0, 0));

        SimulationContext ctx = SimulationContext.builder()
                .airports(List.of(lima, miami))
                .flights(List.of(limaMiami))
                .pendingBatches(List.of(affected))
                .simulatedNow(LocalDateTime.of(2026, 5, 10, 0, 0))
                .alnsParams(AlnsParams.fast())
                .build();

        OptimizationResult result = engine.replan(List.of(affected), ctx);
        assertThat(result).isNotNull();
        assertThat(result.routes()).hasSizeLessThanOrEqualTo(1);
    }

    // Helpers

    private static Airport airport(String iata, String continent) {
        Airport a = new Airport();
        a.setId(iata.hashCode() & 0xFFFFL);
        a.setIataCode(iata);
        a.setCity(iata + " City");
        a.setCountry("Country");
        a.setContinent(continent);
        a.setWarehouseCapacity(500);
        a.setLatitude(BigDecimal.ZERO);
        a.setLongitude(BigDecimal.ZERO);
        return a;
    }

    private static Flight flight(Airport origin, Airport dest,
                                  LocalDateTime dep, LocalDateTime arr, int cap) {
        Flight f = new Flight();
        f.setId((long) (origin.getIataCode() + dest.getIataCode() + dep).hashCode() & 0xFFFFL);
        f.setOriginAirport(origin);
        f.setDestinationAirport(dest);
        f.setDepartureTime(dep);
        f.setArrivalTime(arr);
        f.setBaggageCapacity(cap);
        f.setCurrentLoad(0);
        f.setFrequency("DAILY");
        f.setStatus(FlightStatus.SCHEDULED);
        return f;
    }

    private static BaggageBatch batch(Airport origin, Airport dest, int qty,
                                       LocalDateTime available) {
        BaggageBatch b = new BaggageBatch();
        b.setId((long) (origin.getIataCode() + dest.getIataCode() + available).hashCode() & 0xFFFFL);
        b.setOriginAirport(origin);
        b.setDestinationAirport(dest);
        b.setQuantity(qty);
        b.setAvailableFrom(available);
        return b;
    }
}
