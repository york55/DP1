package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airline;
import pe.pucp.tasfb2b.domain.ClpAirport;
import pe.pucp.tasfb2b.domain.ClpBaggageBatch;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.repository.AirlineRepository;
import pe.pucp.tasfb2b.repository.ClpAirportRepository;
import pe.pucp.tasfb2b.repository.ClpBaggageBatchRepository;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Reads raw envio data from disk files (same format as ShipmentService.crearBatchesDesdeArchivosAsync)
 * but persists to Clp_baggage_batches. Used by ClpBlockOrchestrator for periodic envio loading.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClpEnvioLoader {

    @Value("${tasf.uploads.dir:uploads}")
    private String uploadsDir;

    private final ClpAirportRepository clpAirportRepo;
    private final ClpBaggageBatchRepository clpBatchRepo;
    private final AirlineRepository airlineRepo;

    private static final Pattern IATA_PATTERN = Pattern.compile("envios_([A-Za-z]{4})_");

    /**
     * Reads envio files from disk and creates ClpBaggageBatch records for the given date range.
     * Returns the number of batches inserted.
     */
    @Transactional
    public int loadFromFiles(LocalDateTime rangeStart, LocalDateTime rangeEnd) {
        Path uploadsPath = Paths.get(uploadsDir).toAbsolutePath().normalize();

        List<Path> archivos;
        try (Stream<Path> stream = Files.list(uploadsPath)) {
            archivos = stream
                    .filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .sorted()
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("ClpEnvioLoader: no se pudo leer la carpeta de uploads: {}", e.getMessage());
            return 0;
        }

        if (archivos.isEmpty()) {
            log.warn("ClpEnvioLoader: no hay archivos .txt en {}", uploadsPath);
            return 0;
        }

        Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);
        if (airline == null) {
            log.error("ClpEnvioLoader: no hay aerolíneas registradas.");
            return 0;
        }

        Map<String, ClpAirport> airportCache = new HashMap<>();
        clpAirportRepo.findAll().forEach(a -> airportCache.put(a.getIataCode(), a));

        int batchSize = 1000;
        List<ClpBaggageBatch> buffer = new ArrayList<>(batchSize);
        int totalInserted = 0;

        for (Path archivo : archivos) {
            String filename = archivo.getFileName().toString();
            Matcher m = IATA_PATTERN.matcher(filename);
            if (!m.find()) {
                log.warn("ClpEnvioLoader: no se pudo extraer IATA de: {}", filename);
                continue;
            }
            String originIata = m.group(1).toUpperCase();
            ClpAirport origin = airportCache.get(originIata);
            if (origin == null) {
                log.warn("ClpEnvioLoader: aeropuerto origen {} no existe en Clp_airports", originIata);
                continue;
            }

            int insertedForOrigin = 0;

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

                        if (availableFrom.isBefore(rangeStart)) continue;
                        if (availableFrom.isAfter(rangeEnd)) break; // archivos ordenados por fecha

                        ClpAirport dest = airportCache.get(destIata);
                        if (dest == null) continue;

                        ClpBaggageBatch batch = new ClpBaggageBatch();
                        batch.setAirline(airline);
                        batch.setOriginAirport(origin);
                        batch.setDestinationAirport(dest);
                        batch.setQuantity(qty);
                        batch.setAvailableFrom(availableFrom);
                        batch.setStatus(BatchStatus.IN_ORIGIN);
                        buffer.add(batch);
                        insertedForOrigin++;

                        if (buffer.size() >= batchSize) {
                            clpBatchRepo.saveAll(buffer);
                            buffer.clear();
                        }
                    } catch (Exception ex) {
                        // línea inválida, ignorar
                    }
                }
            } catch (Exception e) {
                log.error("ClpEnvioLoader: error leyendo archivo {}: {}", filename, e.getMessage());
                continue;
            }

            totalInserted += insertedForOrigin;
            log.info("ClpEnvioLoader: {} — {} batches insertados", originIata, insertedForOrigin);
        }

        if (!buffer.isEmpty()) {
            clpBatchRepo.saveAll(buffer);
        }

        log.info("ClpEnvioLoader: total {} batches creados para rango [{}, {}]", totalInserted, rangeStart, rangeEnd);
        return totalInserted;
    }
}