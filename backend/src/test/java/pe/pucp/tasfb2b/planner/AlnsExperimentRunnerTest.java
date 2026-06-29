package pe.pucp.tasfb2b.planner;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.planner.alns.AlnsEngine;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.repository.*;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AlnsExperimentRunnerTest {

    @Autowired
    private AlnsEngine alnsEngine;

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

    @Test
    void runAlnsParameterExperiments() throws Exception {
        // 1. Setup seed data
        List<Airport> airports = airportRepo.findAll();
        List<Airline> airlines = airlineRepo.findAll();
        assertThat(airports).isNotEmpty();
        assertThat(airlines).isNotEmpty();

        Airport origin = airportRepo.findByIataCode("SKBO")
                .orElseThrow(() -> new AssertionError("Aeropuerto SKBO no encontrado."));
        Airline airline = airlines.get(0);

        // Load large test shipments dataset
        File txtFile = new File("../../raw-data/_envios_preliminar-20260416T023321Z-3-001/_envios_preliminar/_envios_SKBO_.txt");
        assertThat(txtFile).exists();

        List<BaggageBatch> batchList = new ArrayList<>();
        Map<String, Airport> destCache = new HashMap<>();

        // Base dates for shifting
        LocalDate fileBaseDate = LocalDate.of(2026, 1, 2);
        LocalDate simBaseDate = LocalDate.of(2026, 5, 10);
        long daysOffset = ChronoUnit.DAYS.between(fileBaseDate, simBaseDate);

        int maxTestRecords = 2000;
        int loadedCount = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(txtFile))) {
            String line;
            while ((line = reader.readLine()) != null && loadedCount < maxTestRecords) {
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

                    LocalDateTime originalAvailable = LocalDateTime.of(year, month, day, hour, min);
                    // Dynamically map date to the simulation starting in May 2026
                    LocalDateTime shiftedAvailable = originalAvailable.plusDays(daysOffset);

                    Airport dest = destCache.computeIfAbsent(destIata,
                            k -> airportRepo.findByIataCode(k).orElse(null));

                    if (dest != null) {
                        BaggageBatch batch = new BaggageBatch();
                        batch.setAirline(airline);
                        batch.setOriginAirport(origin);
                        batch.setDestinationAirport(dest);
                        batch.setQuantity(qty);
                        batch.setAvailableFrom(shiftedAvailable);
                        batch.setStatus(BatchStatus.IN_ORIGIN);
                        batchList.add(batch);
                        loadedCount++;
                    }
                }
            }
        }

        assertThat(batchList).isNotEmpty();
        batchRepo.saveAll(batchList);

        // Setup base context parameters
        LocalDateTime blockStart = LocalDateTime.of(2026, 5, 10, 0, 0);
        LocalDateTime flightLookahead = blockStart.plusHours(48);
        List<Flight> flights = flightRepo.findScheduledBetween(blockStart, flightLookahead);
        
        // Find unrouted batches for the first 24 hours of the simulation (May 10)
        List<BaggageBatch> pending = batchRepo.findUnroutedBatches(blockStart.plusHours(24));

        assertThat(flights).isNotEmpty();
        assertThat(pending).isNotEmpty();

        // Define 4 experiment parameter configurations
        List<ExperimentConfig> configs = List.of(
                new ExperimentConfig("Config 1 (Default)", new AlnsParams(100.0, 0.9995, 0.25, 1000, 100, 9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 0.0, 3, 30)),
                new ExperimentConfig("Config 2 (Fast & Aggressive)", new AlnsParams(50.0, 0.99, 0.35, 300, 50, 9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 0.0, 2, 30)),
                new ExperimentConfig("Config 3 (High Temperature)", new AlnsParams(500.0, 0.999, 0.20, 1000, 100, 9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 0.0, 3, 30)),
                new ExperimentConfig("Config 4 (Intensive Search)", new AlnsParams(100.0, 0.9997, 0.15, 2000, 100, 9.0, 3.0, 1.0, 0.1, 0.05, 0.7, 0.15, 0.15, 0.0, 4, 30))
        );

        System.out.println("\n=== EXPERIMENTOS ALNS A GRAN ESCALA INICIADOS ===");
        System.out.println("Lotes totales cargados: " + pending.size());
        System.out.printf("%-28s | %-12s | %-12s | %-15s | %-10s%n", "Configuracion", "Asignados", "Fallidos", "Obj Value", "Tiempo (ms)");
        System.out.println("---------------------------------------------------------------------------------------");

        for (ExperimentConfig config : configs) {
            SimulationContext context = SimulationContext.builder()
                    .airports(airports)
                    .flights(flights)
                    .pendingBatches(pending)
                    .simulatedNow(blockStart)
                    .alnsParams(config.params)
                    .build();

            // Run AlnsEngine directly to avoid DB route persistence overhead in measurements
            OptimizationResult res = alnsEngine.optimize(context);

            System.out.printf("%-28s | %-12d | %-12d | %-15.6f | %-10d%n",
                    config.name, res.assignedCount(), res.failedCount(), res.objectiveValue(), res.computeTime().toMillis());

            assertThat(res).isNotNull();
        }
        System.out.println("====================================\n");
    }

    private static class ExperimentConfig {
        String name;
        AlnsParams params;

        ExperimentConfig(String name, AlnsParams params) {
            this.name = name;
            this.params = params;
        }
    }
}
