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
import pe.pucp.tasfb2b.dto.response.RouteLegDto;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;
import pe.pucp.tasfb2b.dto.response.UploadProgressDto;
import pe.pucp.tasfb2b.mapper.ShipmentMapper;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.simulation.EnvioStore;
import pe.pucp.tasfb2b.simulation.RawEnvio;
import org.springframework.beans.factory.annotation.Value;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
    private final RouteRepository routeRepo;
    private final RouteLegRepository routeLegRepo;

    @Transactional(readOnly = true)
    public List<RouteLegDto> getRoute(Long batchId) {
        // El frontend identifica envíos por el id del BaggageBatch (ShipmentMapper#batchToDto
        // expone dto.id = batch.id). El Shipment tiene su propia secuencia y solo se crea
        // cuando el ALNS rutea el lote, así que ambos ids divergen — hay que resolver el
        // shipment vía el batch en lugar de asumir que los ids coinciden.
        Shipment shipment = shipmentRepo.findByBaggageBatchId(batchId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "El envío " + batchId + " no tiene una ruta planificada todavía"));
        Route route = routeRepo.findByShipmentId(shipment.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "El envío " + batchId + " no tiene una ruta planificada todavía"));

        return routeLegRepo.findByRouteIdOrderByLegOrder(route.getId()).stream()
                .map(leg -> {
                    Flight f = leg.getFlight();
                    return new RouteLegDto(
                            leg.getLegOrder(),
                            f.getId(),
                            f.getOriginAirport().getIataCode(),
                            f.getDestinationAirport().getIataCode(),
                            f.getDepartureTime(),
                            f.getArrivalTime(),
                            leg.getStatus().name());
                })
                .collect(Collectors.toList());
    }

    public Page<ShipmentDto> findByStatus(ShipmentStatus status, Pageable pageable) {
        return shipmentRepo.findByStatus(status, pageable)
                .map(shipmentMapper::toDto);
    }

    public List<ShipmentDto> findAll() {
        // Vuelo "actual" de cada lote: si está embarcado gana el tramo IN_FLIGHT; si está
        // en tierra (recién planificado o replanificado tras una cancelación) se reporta
        // su siguiente tramo PENDING, para que la lista de envíos apunte al vuelo donde
        // realmente aparece en el panel de detalle.
        Map<Long, Long> currentFlightByBatchId = routeLegRepo.findNextFlightIdByBatchId().stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1], (a, b) -> a));
        routeLegRepo.findCurrentFlightIdByBatchId()
                .forEach(row -> currentFlightByBatchId.put((Long) row[0], (Long) row[1]));

        return batchRepo.findAll().stream()
                .map(shipmentMapper::batchToDto)
                .peek(dto -> dto.setCurrentFlightId(currentFlightByBatchId.get(dto.getBatchId())))
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

    // ── NUEVO: leer desde archivos en disco en lugar del EnvioStore ───────────

    @Value("${tasf.uploads.dir:uploads}")
    private String uploadsDir;

    /**
     * Alternativa a crearBatchesDesdeStoreAsync: lee los archivos .txt
     * de la carpeta uploads/ filtrando por rango durante la lectura,
     * sin cargar todo en memoria. El resto del flujo es idéntico.
     */
    @Async
    @Transactional
    public void crearBatchesDesdeArchivosAsync(int periodo, LocalDateTime startDate) {
        LocalDateTime endDate = startDate.plusDays(periodo);
        log.info("Creando batches desde archivos. Rango: {} -> {}", startDate, endDate);

        Path uploadsPath = Paths.get(uploadsDir).toAbsolutePath().normalize();

        List<Path> archivos;
        try (Stream<Path> stream = Files.list(uploadsPath)) {
            archivos = stream
                    .filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .sorted()
                    .collect(Collectors.toList());
        } catch (Exception e) {
            sendError("No se pudo leer la carpeta de uploads: " + e.getMessage(), "__FILES__");
            return;
        }

        if (archivos.isEmpty()) {
            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(0, 0, "ALL_COMPLETED",
                            "No hay archivos en uploads.", "__ALL__", 0));
            return;
        }

        Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);
        if (airline == null) {
            sendError("No hay aerolíneas registradas.", "__FILES__");
            return;
        }

        Map<String, Airport> airportCache = new HashMap<>();
        int batchSize = 1000;
        List<BaggageBatch> buffer = new ArrayList<>(batchSize);
        int totalInserted = 0;
        Pattern iataPattern = Pattern.compile("envios_([A-Za-z]{4})_");

        for (Path archivo : archivos) {
            String filename = archivo.getFileName().toString();
            Matcher m = iataPattern.matcher(filename);
            if (!m.find()) {
                log.warn("No se pudo extraer IATA de: {}", filename);
                continue;
            }
            String originIata = m.group(1).toUpperCase();
            int insertedForOrigin = 0;

            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(0, 0, "IN_PROGRESS",
                            "Procesando " + originIata + "...", originIata, 0));

            try (BufferedReader reader = Files.newBufferedReader(archivo, StandardCharsets.UTF_8)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;

                    // Formato: 000000001-20260102-00-47-SUAA-002-0032535
                    String[] parts = line.split("-");
                    if (parts.length < 6) continue;

                    try {
                        String dateStr = parts[1];
                        int year  = Integer.parseInt(dateStr.substring(0, 4));
                        int month = Integer.parseInt(dateStr.substring(4, 6));
                        int day   = Integer.parseInt(dateStr.substring(6, 8));
                        int hour  = Integer.parseInt(parts[2]);
                        int min   = Integer.parseInt(parts[3]);
                        String destIata = parts[4];
                        int qty   = Integer.parseInt(parts[5]);

                        LocalDateTime availableFrom = LocalDateTime.of(year, month, day, hour, min);

                        if (availableFrom.isBefore(startDate)) continue;
                        if (availableFrom.isAfter(endDate)) break; // asume archivos ordenados por fecha

                        Airport origin = airportCache.computeIfAbsent(originIata,
                                k -> airportRepo.findByIataCode(k).orElse(null));
                        Airport dest = airportCache.computeIfAbsent(destIata,
                                k -> airportRepo.findByIataCode(k).orElse(null));

                        if (origin != null && dest != null) {
                            BaggageBatch batch = new BaggageBatch();
                            batch.setAirline(airline);
                            batch.setOriginAirport(origin);
                            batch.setDestinationAirport(dest);
                            batch.setQuantity(qty);
                            batch.setAvailableFrom(availableFrom);
                            batch.setStatus(BatchStatus.IN_ORIGIN);
                            buffer.add(batch);
                            insertedForOrigin++;
                        }

                        if (buffer.size() >= batchSize) {
                            batchRepo.saveAll(buffer);
                            buffer.clear();
                        }

                    } catch (Exception ex) {
                        log.trace("Línea inválida ignorada en {}: {}", filename, line);
                    }
                }
            } catch (Exception e) {
                log.error("Error leyendo archivo {}: {}", filename, e.getMessage());
                sendError("Error leyendo " + filename + ": " + e.getMessage(), originIata);
                continue;
            }

            totalInserted += insertedForOrigin;
            messagingTemplate.convertAndSend("/topic/shipments/progress",
                    new UploadProgressDto(insertedForOrigin, insertedForOrigin, "COMPLETED",
                            "Completado: " + insertedForOrigin + " batches", originIata, insertedForOrigin));
        }

        if (!buffer.isEmpty()) {
            batchRepo.saveAll(buffer);
        }

        messagingTemplate.convertAndSend("/topic/shipments/progress",
                new UploadProgressDto(totalInserted, totalInserted, "ALL_COMPLETED",
                        "Todos los batches creados: " + totalInserted, "__ALL__", totalInserted));

        log.info("Batches creados desde archivos en disco: {}", totalInserted);
    }

    // ─────────────────────────────────────────────────────────────────────────

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