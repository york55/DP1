package pe.pucp.tasfb2b.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.planner.OptimizationResult;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.*;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlannerIntegrationTest {

    @Autowired
    private PlannerService plannerService;

    @Autowired
    private BaggageBatchRepository batchRepo;

    @Autowired
    private AirportRepository airportRepo;

    @Autowired
    private AirlineRepository airlineRepo;

    @Autowired
    private FlightRepository flightRepo;

    @Autowired
    private SimulationRepository simulationRepo;

    @Autowired
    private ShipmentRepository shipmentRepo;

    @Autowired
    private RouteRepository routeRepo;

    @Autowired
    private RouteLegRepository routeLegRepo;

    @Test
    void testInitialPlanningWithRealTestData() throws Exception {
        // 1. Ensure airports and airlines are seeded (DataSeeder should run on startup)
        List<Airport> airports = airportRepo.findAll();
        List<Airline> airlines = airlineRepo.findAll();
        assertThat(airports).isNotEmpty();
        assertThat(airlines).isNotEmpty();

        Airport origin = airportRepo.findByIataCode("SKBO")
                .orElseThrow(() -> new AssertionError("Aeropuerto SKBO de origen no encontrado."));
        Airline airline = airlines.get(0);

        // 2. Create and Save Simulation Parameter
        Simulation sim = new Simulation();
        sim.setScenarioType(ScenarioType.PERIOD);
        sim.setPeriodDays(5);
        sim.setStartDate(LocalDate.of(2026, 5, 10).atStartOfDay());
        sim.setCancellationRate(BigDecimal.valueOf(0.0));
        sim.setSeed(42L);
        sim.setAlgorithm("ALNS");
        sim.setStatus(SimulationStatus.CONFIGURED);
        
        // Use fast ALNS parameters for testing to speed up test execution
        sim.setT0(100.0);
        sim.setAlphaSa(0.99);
        sim.setQPct(0.2);
        sim.setMaxIterations(50); // Small iterations for fast test run
        
        sim = simulationRepo.save(sim);

        // 3. Load test data from test_data/_envios_SKBO_mayo2026.txt
        File txtFile = new File("test_data/_envios_SKBO_mayo2026.txt");
        assertThat(txtFile).exists();

        List<BaggageBatch> batchList = new ArrayList<>();
        Map<String, Airport> destCache = new HashMap<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(txtFile))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] parts = line.split("-");
                if (parts.length >= 6) {
                    String dateStr = parts[1];
                    String hourStr = parts[2];
                    String minStr = parts[3];
                    String destIata = parts[4];
                    int qty = Integer.parseInt(parts[5]);

                    int year = Integer.parseInt(dateStr.substring(0, 4));
                    int month = Integer.parseInt(dateStr.substring(4, 6));
                    int day = Integer.parseInt(dateStr.substring(6, 8));
                    int hour = Integer.parseInt(hourStr);
                    int min = Integer.parseInt(minStr);

                    LocalDateTime availableFrom = LocalDateTime.of(year, month, day, hour, min);

                    Airport dest = destCache.computeIfAbsent(destIata,
                            k -> airportRepo.findByIataCode(k).orElse(null));

                    if (dest != null) {
                        BaggageBatch batch = new BaggageBatch();
                        batch.setAirline(airline);
                        batch.setOriginAirport(origin);
                        batch.setDestinationAirport(dest);
                        batch.setQuantity(qty);
                        batch.setAvailableFrom(availableFrom);
                        batch.setStatus(BatchStatus.IN_ORIGIN);
                        batchList.add(batch);
                    }
                }
            }
        }

        assertThat(batchList).isNotEmpty();
        batchRepo.saveAll(batchList);

        // 4. Build SimulationContext
        LocalDateTime blockStart = LocalDateTime.of(2026, 5, 10, 0, 0);
        LocalDateTime flightLookahead = blockStart.plusHours(48);
        List<Flight> flights = flightRepo.findScheduledBetween(blockStart, flightLookahead);
        List<BaggageBatch> pending = batchRepo.findUnroutedBatches(blockStart.plusHours(12));

        assertThat(flights).isNotEmpty();
        assertThat(pending).isNotEmpty();

        SimulationContext context = SimulationContext.builder()
                .airports(airports)
                .flights(flights)
                .pendingBatches(pending)
                .simulatedNow(blockStart)
                .alnsParams(plannerService.buildAlnsParams(sim))
                .build();

        // 5. Run the planner
        OptimizationResult result = plannerService.plan(context, "ALNS");

        // 6. Assert planner results are persisted and valid
        assertThat(result).isNotNull();
        assertThat(result.routes()).isNotEmpty();
        
        // Assert database persistence of shipments, routes, and route legs
        long shipmentCount = shipmentRepo.count();
        long routeCount = routeRepo.count();
        long routeLegCount = routeLegRepo.count();

        assertThat(shipmentCount).isGreaterThan(0);
        assertThat(routeCount).isGreaterThan(0);
        assertThat(routeLegCount).isGreaterThan(0);

        // Spot check a route/shipment to ensure they are linked
        List<Route> savedRoutes = routeRepo.findAll();
        Route sampleRoute = savedRoutes.get(0);
        assertThat(sampleRoute.getShipment()).isNotNull();
        assertThat(sampleRoute.getLegs()).isNotEmpty();

        for (RouteLeg leg : sampleRoute.getLegs()) {
            assertThat(leg.getFlight()).isNotNull();
            assertThat(leg.getRoute()).isEqualTo(sampleRoute);
        }
    }
}
