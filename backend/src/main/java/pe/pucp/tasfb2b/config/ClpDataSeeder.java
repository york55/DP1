package pe.pucp.tasfb2b.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.ClpAirport;
import pe.pucp.tasfb2b.domain.ClpFlight;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.ClpAirportRepository;
import pe.pucp.tasfb2b.repository.ClpFlightRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;


import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Copies data from the master `airports` and `flights` tables into the
 * Clp_ equivalents at startup, if they are empty.
 * Runs AFTER DataSeeder (which populates airports/flights from txt files).
 */
@Slf4j
@Component
@DependsOn("dataSeeder")
@RequiredArgsConstructor
public class ClpDataSeeder implements CommandLineRunner {

    private final AirportRepository airportRepo;
    private final ClpAirportRepository clpAirportRepo;
    private final FlightRepository flightRepo;
    private final ClpFlightRepository clpFlightRepo;

    @Override
    @Transactional
    public void run(String... args) {
        seedAirports();
        seedFlights();
    }

    private void seedAirports() {
        if (clpAirportRepo.count() > 0) {
            log.info("[CLP] Clp_airports ya poblada ({} registros).", clpAirportRepo.count());
            return;
        }

        List<Airport> airports = airportRepo.findAll();
        if (airports.isEmpty()) {
            log.warn("[CLP] Tabla airports vacía — no se puede poblar Clp_airports.");
            return;
        }

        for (Airport a : airports) {
            ClpAirport ca = new ClpAirport();
            ca.setIataCode(a.getIataCode());
            ca.setCity(a.getCity());
            ca.setCountry(a.getCountry());
            ca.setContinent(a.getContinent());
            ca.setWarehouseCapacity(a.getWarehouseCapacity());
            ca.setCurrentOccupancy(0);
            ca.setGmtOffset(a.getGmtOffset());
            ca.setLatitude(a.getLatitude());
            ca.setLongitude(a.getLongitude());
            clpAirportRepo.save(ca);
        }

        log.info("[CLP] Copiados {} aeropuertos a Clp_airports.", airports.size());
    }

    private void seedFlights() {
        // Only seed DAILY templates if Clp_flights is empty
        long dailyCount = clpFlightRepo.findByFrequency("DAILY").size();
        if (dailyCount > 0) {
            log.info("[CLP] Clp_flights ya tiene {} plantillas DAILY.", dailyCount);
            return;
        }

        List<Flight> templates = flightRepo.findByFrequency("DAILY");
        if (templates.isEmpty()) {
            log.warn("[CLP] Sin vuelos DAILY en flights — no se puede poblar Clp_flights.");
            return;
        }

        // Build airport IATA → ClpAirport mapping
        Map<String, ClpAirport> clpAirportMap = new HashMap<>();
        clpAirportRepo.findAll().forEach(ca -> clpAirportMap.put(ca.getIataCode(), ca));

        int copied = 0;
        for (Flight f : templates) {
            ClpAirport origin = clpAirportMap.get(f.getOriginAirport().getIataCode());
            ClpAirport dest = clpAirportMap.get(f.getDestinationAirport().getIataCode());
            if (origin == null || dest == null) continue;

            ClpFlight cf = new ClpFlight();
            cf.setAirline(f.getAirline());
            cf.setOriginAirport(origin);
            cf.setDestinationAirport(dest);
            cf.setDepartureTime(f.getDepartureTime());
            cf.setArrivalTime(f.getArrivalTime());
            cf.setBaggageCapacity(f.getBaggageCapacity());
            cf.setCurrentLoad(0);
            cf.setFrequency("DAILY");
            cf.setStatus(FlightStatus.SCHEDULED);
            clpFlightRepo.save(cf);
            copied++;
        }

        log.info("[CLP] Copiados {} vuelos plantilla DAILY a Clp_flights.", copied);
    }
}
