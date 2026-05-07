package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.domain.FlightCancellation;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.dto.response.FlightDto;
import pe.pucp.tasfb2b.exception.SimulationNotFoundException;
import pe.pucp.tasfb2b.mapper.FlightMapper;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.FlightCancellationRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;

import java.io.InputStreamReader;
import java.io.Reader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlightService {

    private static final DateTimeFormatter ISO_DT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final FlightRepository flightRepo;
    private final AirportRepository airportRepo;
    private final FlightCancellationRepository cancellationRepo;
    private final FlightMapper flightMapper;

    public List<FlightDto> findAll() {
        return flightRepo.findAllWithAirports().stream()
                .map(flightMapper::toDto)
                .collect(Collectors.toList());
    }

    public List<FlightDto> findByStatus(FlightStatus status) {
        return flightRepo.findByStatus(status).stream()
                .map(flightMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public FlightDto cancelFlight(Long flightId, String reason, LocalDateTime simNow) {
        Flight flight = flightRepo.findById(flightId)
                .orElseThrow(() -> new SimulationNotFoundException(flightId));

        if (flight.getStatus() == FlightStatus.CANCELLED) {
            throw new IllegalArgumentException("El vuelo ya está cancelado");
        }

        flight.setStatus(FlightStatus.CANCELLED);
        flightRepo.save(flight);

        FlightCancellation cancellation = new FlightCancellation(
                flight, simNow != null ? simNow : LocalDateTime.now(), reason);
        cancellationRepo.save(cancellation);

        log.info("Vuelo {} cancelado manualmente. Motivo: {}", flightId, reason);
        return flightMapper.toDto(flight);
    }

    @Transactional
    public Map<String, Object> uploadFlights(MultipartFile file) {
        int imported = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        try (Reader reader = new InputStreamReader(file.getInputStream());
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                try {
                    String originIata = record.get("origin_iata").trim();
                    String destIata = record.get("destination_iata").trim();
                    LocalDateTime dep = LocalDateTime.parse(record.get("departure_time").trim(), ISO_DT);
                    LocalDateTime arr = LocalDateTime.parse(record.get("arrival_time").trim(), ISO_DT);
                    int cap = Integer.parseInt(record.get("baggage_capacity").trim());
                    String freq = record.get("frequency").trim();

                    Airport origin = airportRepo.findByIataCode(originIata)
                            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto desconocido: " + originIata));
                    Airport dest = airportRepo.findByIataCode(destIata)
                            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto desconocido: " + destIata));

                    Flight flight = new Flight();
                    flight.setOriginAirport(origin);
                    flight.setDestinationAirport(dest);
                    flight.setDepartureTime(dep);
                    flight.setArrivalTime(arr);
                    flight.setBaggageCapacity(cap);
                    flight.setFrequency(freq);
                    flight.setStatus(FlightStatus.SCHEDULED);
                    flightRepo.save(flight);
                    imported++;

                } catch (Exception e) {
                    failed++;
                    errors.add("Fila " + parser.getCurrentLineNumber() + ": " + e.getMessage());
                    log.warn("Error importando vuelo: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error procesando archivo de vuelos: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Error procesando archivo: " + e.getMessage());
        }

        return Map.of("imported", imported, "failed", failed, "errors", errors);
    }
}
