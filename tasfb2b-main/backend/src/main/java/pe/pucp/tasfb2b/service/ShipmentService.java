package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;
import pe.pucp.tasfb2b.mapper.ShipmentMapper;
import pe.pucp.tasfb2b.repository.*;

import java.io.InputStreamReader;
import java.io.Reader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShipmentService {

    private final ShipmentRepository shipmentRepo;
    private final BaggageBatchRepository batchRepo;
    private final AirlineRepository airlineRepo;
    private final AirportRepository airportRepo;
    private final ShipmentMapper shipmentMapper;

    public Page<ShipmentDto> findByStatus(ShipmentStatus status, Pageable pageable) {
        return shipmentRepo.findByStatus(status, pageable)
                .map(shipmentMapper::toDto);
    }

    public List<ShipmentDto> findAll() {
        return shipmentRepo.findAll().stream()
                .map(shipmentMapper::toDto)
                .collect(Collectors.toList());
    }

    public ShipmentDto findById(Long id) {
        return shipmentRepo.findById(id)
                .map(shipmentMapper::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Envío no encontrado: " + id));
    }

    public LocalDateTime computeDeadline(BaggageBatch batch, LocalDateTime simNow) {
        boolean sameContinent = batch.isSameContinent();
        int days = sameContinent ? 1 : 2;
        return batch.getAvailableFrom().plus(days, ChronoUnit.DAYS);
    }

    @Transactional
    public Map<String, Object> uploadBatches(MultipartFile file) {
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
                    String airlineIata = record.get("airline_iata").trim();
                    String originIata = record.get("origin_iata").trim();
                    String destIata = record.get("destination_iata").trim();
                    int qty = Integer.parseInt(record.get("quantity").trim());
                    LocalDateTime availableFrom = LocalDateTime.parse(
                            record.get("available_from").trim(),
                            DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    Airline airline = airlineRepo.findByIataCode(airlineIata)
                            .orElseThrow(() -> new IllegalArgumentException("Aerolínea desconocida: " + airlineIata));
                    Airport origin = airportRepo.findByIataCode(originIata)
                            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto desconocido: " + originIata));
                    Airport dest = airportRepo.findByIataCode(destIata)
                            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto desconocido: " + destIata));

                    BaggageBatch batch = new BaggageBatch();
                    batch.setAirline(airline);
                    batch.setOriginAirport(origin);
                    batch.setDestinationAirport(dest);
                    batch.setQuantity(qty);
                    batch.setAvailableFrom(availableFrom);
                    batch.setStatus(BatchStatus.IN_ORIGIN);
                    batchRepo.save(batch);
                    imported++;

                } catch (Exception e) {
                    failed++;
                    errors.add("Fila " + parser.getCurrentLineNumber() + ": " + e.getMessage());
                    log.warn("Error importando lote: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error procesando archivo de lotes: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Error procesando archivo: " + e.getMessage());
        }

        return Map.of("imported", imported, "failed", failed, "errors", errors);
    }
}
