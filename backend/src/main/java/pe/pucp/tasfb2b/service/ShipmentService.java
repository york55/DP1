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
import pe.pucp.tasfb2b.simulation.EnvioStore;
import pe.pucp.tasfb2b.simulation.RawEnvio;

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
    private final EnvioStore envioStore;

    public Page<ShipmentDto> findByStatus(ShipmentStatus status, Pageable pageable) {
        return shipmentRepo.findByStatus(status, pageable)
                .map(shipmentMapper::toDto);
    }

    public List<ShipmentDto> findAll() {
        return batchRepo.findAll().stream()
                .map(shipmentMapper::batchToDto)
                .collect(Collectors.toList());
    }

    public List<ShipmentDto> findAllByBatchStatus(BatchStatus status) {
        return batchRepo.findByStatus(status).stream()
                .map(shipmentMapper::batchToDto)
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
    public void uploadBatchesAsync(
            byte[] fileBytes,
            String filename,
            int periodo,
            LocalDateTime startDate) {

        LocalDateTime endDate = startDate.plusDays(periodo);

        log.info("Iniciando carga asíncrona para archivo: {}", filename);
        log.info("Rango de fechas: {} -> {}", startDate, endDate);

        String originIata = extractOriginFromFilename(filename);
        if (originIata == null) {
            log.warn("No se pudo extraer aeropuerto del archivo {}. Usando SKBO.", filename);
            originIata = "SKBO";
        }

        messagingTemplate.convertAndSend("/topic/shipments/progress",
                new UploadProgressDto(
                        0,
                        0,
                        "IN_PROGRESS",
                        "Procesando envíos entre " + startDate + " y " + endDate,
                        originIata,
                        0));

        final String finalOriginIata = originIata;
        try {

            Airport origin = airportRepo.findByIataCode(originIata).orElse(null);

            if (origin == null) {
                sendError("Aeropuerto de origen no encontrado: " + originIata, finalOriginIata);
                return;
            }

            Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);

            if (airline == null) {
                sendError("No hay aerolíneas registradas.", finalOriginIata);
                return;
            }

            // contar líneas
            int totalLines = 0;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(
                            new ByteArrayInputStream(fileBytes),
                            StandardCharsets.UTF_8))) {

                while (reader.readLine() != null) {
                    totalLines++;
                }
            }

            int processed = 0;
            int inserted = 0;

            int batchSize = 1000;

            List<BaggageBatch> batchList = new ArrayList<>(batchSize);

            Map<String, Airport> destCache = new HashMap<>();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(
                            new ByteArrayInputStream(fileBytes),
                            StandardCharsets.UTF_8))) {

                String line;

                while ((line = reader.readLine()) != null) {

                    line = line.trim();

                    if (line.isEmpty()) {
                        continue;
                    }

                    // 000000001-20260102-00-47-SUAA-002-0032535
                    String[] parts = line.split("-");

                    if (parts.length >= 6) {

                        try {

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

                            LocalDateTime availableFrom =
                                    LocalDateTime.of(year, month, day, hour, min);

                            /*
                            * Como el archivo está ordenado por fecha:
                            * - si aún no llegamos al rango -> continuar
                            * - si ya pasamos el rango -> detener procesamiento
                            */

                            if (availableFrom.isBefore(startDate)) {
                                processed++;
                                continue;
                            }

                            if (availableFrom.isAfter(endDate)) {

                                log.info(
                                        "Se alcanzó fecha fuera del rango en {}. Deteniendo lectura.",
                                        availableFrom);

                                break;
                            }

                            Airport dest = destCache.computeIfAbsent(
                                    destIata,
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

                                inserted++;
                            }

                        } catch (Exception e) {

                            log.debug(
                                    "Error procesando línea {}: {}",
                                    line,
                                    e.getMessage());
                        }
                    }

                    processed++;

                    if (batchList.size() >= batchSize) {

                        batchRepo.saveAll(batchList);

                        batchList.clear();

                        messagingTemplate.convertAndSend(
                                "/topic/shipments/progress",
                                new UploadProgressDto(
                                        processed,
                                        totalLines,
                                        "IN_PROGRESS",
                                        "Procesando envíos...",
                                        finalOriginIata,
                                        inserted));
                    }
                }

                // guardar restantes
                if (!batchList.isEmpty()) {
                    batchRepo.saveAll(batchList);
                }
            }

            messagingTemplate.convertAndSend(
                    "/topic/shipments/progress",
                    new UploadProgressDto(
                            processed,
                            totalLines,
                            "COMPLETED",
                            "Carga finalizada. Insertados: " + inserted,
                            finalOriginIata,
                            inserted));

            log.info(
                    "Carga completada. Procesados: {}, Insertados: {}",
                    processed,
                    inserted);

        } catch (Exception e) {

            log.error("Error crítico en carga asíncrona", e);

            sendError("Error interno: " + e.getMessage(), finalOriginIata);
        }
    }
    
    @Async
    @Transactional
    public void crearBatchesDesdeStoreAsync(int periodo, LocalDateTime startDate) {
        LocalDateTime endDate = startDate.plusDays(periodo);
        log.info("Creando batches desde store. Rango: {} -> {}", startDate, endDate);

        if (!envioStore.isLoaded()) {
            sendError("El store de envíos no está cargado. Cargue los datos primero.", "__STORE__");
            return;
        }

        List<RawEnvio> enviosEnRango = envioStore.queryRange(startDate, endDate);
        log.info("Envíos encontrados en rango: {}", enviosEnRango.size());

        if (enviosEnRango.isEmpty()) {
            // nothing to do — signal completion immediately
            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(0, 0, "ALL_COMPLETED",
                            "Sin envíos en el rango seleccionado.", "__ALL__", 0));
            return;
        }

        Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);
        if (airline == null) {
            sendError("No hay aerolíneas registradas.", "__STORE__");
            return;
        }

        // group by origin to emit per-airport progress
        Map<String, List<RawEnvio>> byOrigin = new LinkedHashMap<>();
        for (RawEnvio e : enviosEnRango) {
            byOrigin.computeIfAbsent(e.getOriginIata(), k -> new ArrayList<>()).add(e);
        }

        Map<String, Airport> airportCache = new HashMap<>();
        int batchSize = 1000;
        List<BaggageBatch> buffer = new ArrayList<>(batchSize);
        int totalInserted = 0;

        for (Map.Entry<String, List<RawEnvio>> entry : byOrigin.entrySet()) {
            String originIata = entry.getKey();
            List<RawEnvio> grupo = entry.getValue();
            int insertedForOrigin = 0;

            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(0, grupo.size(), "IN_PROGRESS",
                            "Procesando " + originIata + "...", originIata, 0));

            for (RawEnvio envio : grupo) {
                Airport origin = airportCache.computeIfAbsent(envio.getOriginIata(),
                        k -> airportRepo.findByIataCode(k).orElse(null));
                Airport dest = airportCache.computeIfAbsent(envio.getDestinationIata(),
                        k -> airportRepo.findByIataCode(k).orElse(null));

                if (origin != null && dest != null) {
                    BaggageBatch batch = new BaggageBatch();
                    batch.setAirline(airline);
                    batch.setOriginAirport(origin);
                    batch.setDestinationAirport(dest);
                    batch.setQuantity(envio.getQuantity());
                    batch.setAvailableFrom(envio.getAvailableFrom());
                    batch.setStatus(BatchStatus.IN_ORIGIN);
                    buffer.add(batch);
                    insertedForOrigin++;
                }

                if (buffer.size() >= batchSize) {
                    batchRepo.saveAll(buffer);
                    buffer.clear();
                }
            }

            totalInserted += insertedForOrigin;

            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(grupo.size(), grupo.size(), "COMPLETED",
                            "Completado: " + insertedForOrigin + " batches", originIata, insertedForOrigin));
        }

        if (!buffer.isEmpty()) {
            batchRepo.saveAll(buffer);
        }

        messagingTemplate.convertAndSend("/topic/shipments/progress",
                new UploadProgressDto(totalInserted, totalInserted, "ALL_COMPLETED",
                        "Todos los batches creados: " + totalInserted, "__ALL__", totalInserted));

        log.info("Batches creados desde store: {}", totalInserted);
    }

    private void sendError(String message, String aeropuerto) {
        messagingTemplate.convertAndSend("/topic/shipments/progress",
            new UploadProgressDto(0, 0, "ERROR", message, aeropuerto, 0));
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
