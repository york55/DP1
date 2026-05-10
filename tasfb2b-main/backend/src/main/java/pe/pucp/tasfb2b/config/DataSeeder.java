package pe.pucp.tasfb2b.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (airportRepository.count() == 0) {
            log.info("Populating Airports from aeropuertos.txt...");
            populateAirports();
        } else {
            log.info("Airports table already populated.");
        }

        if (flightRepository.count() == 0) {
            log.info("Populating Flights from vuelos.txt...");
            populateFlights();
        } else {
            log.info("Flights table already populated.");
        }
    }

    private void populateAirports() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource("data/aeropuertos.txt").getInputStream(), StandardCharsets.UTF_16))) {
            
            String line;
            String currentContinent = "Unknown";
            Pattern airportPattern = Pattern.compile("^\\d+\\s+([A-Z]{4})\\s+(.+?)\\s{2,}(.+?)\\s{2,}([a-z]{4})\\s+([\\+\\-]?\\d+)\\s+(\\d+)\\s+Latitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([NS])\\s+Longitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([EW])\\??.*$");
            
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("*") || line.startsWith("PDDS") || line.contains("GMT")) {
                    continue;
                }

                // If line does not start with digits, it might be a continent header
                if (!line.matches("^\\d+.*")) {
                    currentContinent = line.replace(".", "").trim();
                    continue;
                }

                Matcher m = airportPattern.matcher(line);
                if (m.matches()) {
                    Airport airport = new Airport();
                    airport.setIataCode(m.group(1)); // Note: File has ICAO (e.g. SKBO), but using it as IATA/Identifier
                    airport.setCity(m.group(2).trim());
                    airport.setCountry(m.group(3).trim());
                    airport.setContinent(currentContinent);
                    airport.setWarehouseCapacity(Integer.parseInt(m.group(6)));
                    
                    double lat = Double.parseDouble(m.group(7)) + Double.parseDouble(m.group(8))/60.0 + Double.parseDouble(m.group(9))/3600.0;
                    if (m.group(10).equals("S")) lat = -lat;
                    
                    double lon = Double.parseDouble(m.group(11)) + Double.parseDouble(m.group(12))/60.0 + Double.parseDouble(m.group(13))/3600.0;
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

    private void populateFlights() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource("data/vuelos.txt").getInputStream(), StandardCharsets.UTF_8))) {
            
            Map<String, Airport> airportMap = new HashMap<>();
            airportRepository.findAll().forEach(a -> airportMap.put(a.getIataCode(), a));
            
            String line;
            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
            // Assuming default simulation date of 2026-05-10
            LocalDateTime baseDate = LocalDateTime.of(2026, 5, 10, 0, 0);
            
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;
                
                // Format: SKBO-SEQM-03:34-04:21-0300
                String[] parts = line.split("-");
                if (parts.length >= 5) {
                    Airport origin = airportMap.get(parts[0]);
                    Airport dest = airportMap.get(parts[1]);
                    
                    if (origin != null && dest != null) {
                        Flight flight = new Flight();
                        flight.setOriginAirport(origin);
                        flight.setDestinationAirport(dest);
                        
                        LocalTime depTime = LocalTime.parse(parts[2], timeFormatter);
                        LocalTime arrTime = LocalTime.parse(parts[3], timeFormatter);
                        
                        LocalDateTime departure = baseDate.with(depTime);
                        LocalDateTime arrival = baseDate.with(arrTime);
                        if (arrival.isBefore(departure)) {
                            arrival = arrival.plusDays(1); // Crossed midnight
                        }
                        
                        flight.setDepartureTime(departure);
                        flight.setArrivalTime(arrival);
                        flight.setBaggageCapacity(Integer.parseInt(parts[4]));
                        flight.setFrequency("DAILY");
                        flight.setStatus(FlightStatus.SCHEDULED);
                        
                        flightRepository.save(flight);
                    }
                }
            }
            log.info("Successfully loaded {} flights.", flightRepository.count());
        } catch (Exception e) {
            log.error("Error loading flights", e);
        }
    }
}
