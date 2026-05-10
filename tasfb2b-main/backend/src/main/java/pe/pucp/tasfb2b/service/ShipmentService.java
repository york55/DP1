package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;
import pe.pucp.tasfb2b.dto.response.UploadProgressDto;
import pe.pucp.tasfb2b.mapper.ShipmentMapper;
import pe.pucp.tasfb2b.repository.*;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    private final SimpMessagingTemplate messagingTemplate;

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

    @Async
    @Transactional
    public void uploadBatchesAsync(byte[] fileBytes, String filename) {
        log.info("Iniciando carga asíncrona para archivo: {}", filename);
        messagingTemplate.convertAndSend("/topic/shipments/progress", 
            new UploadProgressDto(0, 0, "IN_PROGRESS", "Calculando total de líneas..."));

        String originIata = extractOriginFromFilename(filename);
        if (originIata == null) {
            log.warn("No se pudo extraer el aeropuerto de origen del nombre del archivo: {}. Usando SKBO por defecto.", filename);
            originIata = "SKBO"; // Fallback to SKBO
        }

        try {
            // Check if origin exists
            Airport origin = airportRepo.findByIataCode(originIata).orElse(null);
            if (origin == null) {
                sendError("Aeropuerto de origen no encontrado en BD: " + originIata);
                return;
            }

            // Fallback airline
            Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);
            if (airline == null) {
                sendError("No hay aerolíneas registradas en la BD.");
                return;
            }

            // First pass to count lines
            int totalLines = 0;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    new ByteArrayInputStream(fileBytes), StandardCharsets.UTF_8))) {
                while (reader.readLine() != null) {
                    totalLines++;
                }
            }

            // Second pass to process
            int processed = 0;
            int batchSize = 1000;
            List<BaggageBatch> batchList = new ArrayList<>(batchSize);
            Map<String, Airport> destCache = new HashMap<>();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    new ByteArrayInputStream(fileBytes), StandardCharsets.UTF_8))) {
                
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;

                    // Format: 000000001-20260102-00-47-SUAA-002-0032535
                    String[] parts = line.split("-");
                    if (parts.length >= 6) {
                        try {
                            String dateStr = parts[1]; // 20260102
                            String hourStr = parts[2]; // 00
                            String minStr = parts[3];  // 47
                            String destIata = parts[4]; // SUAA
                            int qty = Integer.parseInt(parts[5]);

                            // parse date
                            int year = Integer.parseInt(dateStr.substring(0, 4));
                            int month = Integer.parseInt(dateStr.substring(4, 6));
                            int day = Integer.parseInt(dateStr.substring(6, 8));
                            int hour = Integer.parseInt(hourStr);
                            int min = Integer.parseInt(minStr);
                            
                            LocalDateTime availableFrom = LocalDateTime.of(year, month, day, hour, min);

                            Airport dest = destCache.computeIfAbsent(destIata, k -> airportRepo.findByIataCode(k).orElse(null));
                            
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
                        } catch (Exception e) {
                            log.debug("Error procesando línea {}: {}", line, e.getMessage());
                        }
                    }

                    processed++;
                    
                    if (batchList.size() >= batchSize) {
                        batchRepo.saveAll(batchList);
                        batchList.clear();
                        messagingTemplate.convertAndSend("/topic/shipments/progress", 
                            new UploadProgressDto(processed, totalLines, "IN_PROGRESS", "Procesando..."));
                    }
                }

                // Save remaining
                if (!batchList.isEmpty()) {
                    batchRepo.saveAll(batchList);
                }
            }

            messagingTemplate.convertAndSend("/topic/shipments/progress", 
                new UploadProgressDto(totalLines, totalLines, "COMPLETED", "Carga finalizada con éxito."));
            log.info("Carga asíncrona completada. Total insertados: {}", totalLines);

        } catch (Exception e) {
            log.error("Error crítico en carga asíncrona", e);
            sendError("Error interno: " + e.getMessage());
        }
    }

    private void sendError(String message) {
        messagingTemplate.convertAndSend("/topic/shipments/progress", 
            new UploadProgressDto(0, 0, "ERROR", message));
    }

    private String extractOriginFromFilename(String filename) {
        if (filename == null) return null;
        // e.g. _envios_EBCI_.txt -> EBCI
        Pattern p = Pattern.compile("envios_([A-Za-z]{4})_");
        Matcher m = p.matcher(filename);
        if (m.find()) {
            return m.group(1).toUpperCase();
        }
        return null;
    }
}
