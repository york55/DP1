package pe.pucp.tasfb2b.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Airline;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.repository.AirlineRepository;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final AirportRepository    airportRepository;
    private final FlightRepository     flightRepository;
    private final AirlineRepository    airlineRepository;
    private final OpsAirportRepository opsAirportRepository;   // ← NUEVO

    @Override
    public void run(String... args) throws Exception {
        // Re-seed if airports exist but gmtOffset was never stored (all zero)
        boolean needReseed = airportRepository.count() > 0 &&
                airportRepository.findAll().stream().allMatch(a -> a.getGmtOffset() == 0);

        if (needReseed) {
            log.info("Detected airports without gmtOffset — re-seeding airports and flights.");
            flightRepository.deleteAll();
            airportRepository.deleteAll();
        }

        if (airportRepository.count() == 0) {
            log.info("Populating Airports from aeropuertos.txt...");
            populateAirports();
        } else {
            log.info("Airports table already populated.");
        }

        // ── OPS_AIRPORT: sincronizar desde Airport ───────────────────────────
        if (opsAirportRepository.count() == 0) {
            log.info("Populating OPS_AIRPORT from Airport table...");
            syncOpsAirports();
        } else {
            log.info("OPS_AIRPORT table already populated ({} rows).", opsAirportRepository.count());
        }

        if (airlineRepository.count() == 0) {
            log.info("Populating Airlines...");
            populateAirlines();
        } else {
            log.info("Airlines table already populated.");
        }

        long dailyCount = flightRepository.findByFrequency("DAILY").size();
        boolean needFlightReseed = flightRepository.count() > 0 &&
                (dailyCount == 0 || dailyCount > 3000);
        if (needFlightReseed) {
            log.info("Detected {} legacy/incorrect DAILY flights — re-seeding.", dailyCount);
            flightRepository.deleteAll();
        }

        if (flightRepository.count() == 0) {
            log.info("Populating Flights from vuelos.txt...");
            populateFlights();
        } else {
            log.info("Flights table already populated.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NUEVO: copia Airport → OpsAirport
    // ─────────────────────────────────────────────────────────────────────────
    private void syncOpsAirports() {
        List<Airport> airports = airportRepository.findAll();

        // Mapeo de continente: el DataSeeder usa nombres en español,
        // OpsAirport los conserva igual para que la lógica de deadline funcione.
        for (Airport a : airports) {
            OpsAirport ops = new OpsAirport();
            ops.setIataCode(a.getIataCode());
            ops.setName(a.getCity());                           // Airport.city → OpsAirport.name
            ops.setCountry(a.getCountry());
            ops.setShortCode(a.getIataCode().substring(0, 4)); // fallback: mismo IATA
            ops.setContinent(a.getContinent());
            ops.setGmtOffset(a.getGmtOffset());
            ops.setCapacity(a.getWarehouseCapacity());
            ops.setLatitude(a.getLatitude() != null ? a.getLatitude().doubleValue() : null);
            ops.setLongitude(a.getLongitude() != null ? a.getLongitude().doubleValue() : null);
            opsAirportRepository.save(ops);
        }
        log.info("OPS_AIRPORT populated with {} airports.", opsAirportRepository.count());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sin cambios desde aquí
    // ─────────────────────────────────────────────────────────────────────────

    private void populateAirports() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource("data/aeropuertos.txt").getInputStream(), StandardCharsets.UTF_16))) {

            String line;
            String currentContinent = "Unknown";
            Pattern airportPattern = Pattern.compile("^\\d+\\s+([A-Z]{4})\\s+(.+?)\\s{2,}(.+?)\\s{2,}([a-z]{4})\\s+([\\+\\-]?\\d+)\\s+(\\d+)\\s+Latitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([NS])\\s+Longitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([EW])\\??.*$");

            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("*") || line.startsWith("PDDS")) continue;
                if (line.contains("GMT") && line.contains("CAPACIDAD")) continue;

                if (!line.matches("^\\d+.*")) {
                    currentContinent = line.replace(".", "").trim();
                    continue;
                }

                Matcher m = airportPattern.matcher(line);
                if (m.matches()) {
                    Airport airport = new Airport();
                    airport.setIataCode(m.group(1));
                    airport.setCity(m.group(2).trim());
                    airport.setCountry(m.group(3).trim());
                    airport.setContinent(currentContinent);
                    airport.setGmtOffset(Integer.parseInt(m.group(5)));
                    airport.setWarehouseCapacity(Integer.parseInt(m.group(6)));

                    double lat = Double.parseDouble(m.group(7)) + Double.parseDouble(m.group(8)) / 60.0 + Double.parseDouble(m.group(9)) / 3600.0;
                    if (m.group(10).equals("S")) lat = -lat;

                    double lon = Double.parseDouble(m.group(11)) + Double.parseDouble(m.group(12)) / 60.0 + Double.parseDouble(m.group(13)) / 3600.0;
                    if (m.group(14).equals("W")) lon = -lon;

                    airport.setLatitude(BigDecimal.valueOf(lat));
                    airport.setLongitude(BigDecimal.valueOf(lon));

                    airportRepository.save(airport);
                }
            }
            log.info("Successfully loaded {} airports.", airportRepository.count());
        } catch (Exception e) {
            log.error("Error loading airports", e);
        }
    }

    private void populateAirlines() {
        List<Object[]> data = List.of(
                new Object[]{"LATAM Airlines",    "LA"},
                new Object[]{"Lufthansa",          "LH"},
                new Object[]{"Singapore Airlines", "SQ"}
        );
        for (Object[] row : data) {
            Airline a = new Airline((String) row[0], (String) row[1], null);
            airlineRepository.save(a);
        }
        log.info("Successfully loaded {} airlines.", airlineRepository.count());
    }

    private static final int SIMULATION_DAYS = 1;

    private void populateFlights() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource("data/vuelos.txt").getInputStream(), StandardCharsets.UTF_8))) {

            Map<String, Airport> airportMap = new HashMap<>();
            airportRepository.findAll().forEach(a -> airportMap.put(a.getIataCode(), a));

            Map<String, Airline> airlineByContinent = new HashMap<>();
            airlineRepository.findByIataCode("LA").ifPresent(a -> {
                airlineByContinent.put("America del Sur", a);
                airlineByContinent.put("Unknown", a);
            });
            airlineRepository.findByIataCode("LH").ifPresent(a -> airlineByContinent.put("Europa", a));
            airlineRepository.findByIataCode("SQ").ifPresent(a -> airlineByContinent.put("Asia", a));
            Airline defaultAirline = airlineRepository.findByIataCode("LA").orElse(null);

            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
            LocalDateTime baseDate = LocalDateTime.of(2026, 5, 10, 0, 0);

            List<String> lines = new java.util.ArrayList<>();
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty()) lines.add(line);
            }

            for (int day = 0; day < SIMULATION_DAYS; day++) {
                LocalDateTime dayBase = baseDate.plusDays(day);
                for (String flightLine : lines) {
                    String flightData = flightLine.contains("\t")
                            ? flightLine.substring(flightLine.lastIndexOf('\t') + 1)
                            : flightLine;
                    String[] parts = flightData.split("-");
                    if (parts.length < 5) continue;

                    Airport origin = airportMap.get(parts[0]);
                    Airport dest   = airportMap.get(parts[1]);
                    if (origin == null || dest == null) continue;

                    LocalTime depLocal = LocalTime.parse(parts[2], timeFormatter);
                    LocalTime arrLocal = LocalTime.parse(parts[3], timeFormatter);

                    LocalDateTime departureUTC = dayBase.with(depLocal).minusHours(origin.getGmtOffset());
                    LocalDateTime arrivalUTC   = dayBase.with(arrLocal).minusHours(dest.getGmtOffset());

                    if (arrivalUTC.isBefore(departureUTC)) arrivalUTC = arrivalUTC.plusDays(1);

                    Flight flight = new Flight();
                    flight.setOriginAirport(origin);
                    flight.setDestinationAirport(dest);
                    flight.setDepartureTime(departureUTC);
                    flight.setArrivalTime(arrivalUTC);
                    flight.setBaggageCapacity(Integer.parseInt(parts[4]));
                    flight.setFrequency("DAILY");
                    flight.setStatus(FlightStatus.SCHEDULED);
                    flight.setAirline(airlineByContinent.getOrDefault(origin.getContinent(), defaultAirline));
                    flightRepository.save(flight);
                }
            }
            log.info("Successfully loaded {} flights ({} days × templates).",
                    flightRepository.count(), SIMULATION_DAYS);
        } catch (Exception e) {
            log.error("Error loading flights", e);
        }
    }
}