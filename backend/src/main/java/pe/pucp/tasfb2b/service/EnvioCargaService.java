package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.dto.response.UploadProgressDto;
import pe.pucp.tasfb2b.simulation.EnvioStore;
import pe.pucp.tasfb2b.simulation.RawEnvio;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnvioCargaService {

    private static final String TOPIC = "/topic/envios/carga";
    private static final Pattern IATA_PATTERN = Pattern.compile("envios_([A-Za-z]{4})_");

    private final EnvioStore envioStore;
    private final SimpMessagingTemplate messagingTemplate;

    @Async
    public void cargarArchivoAsync(byte[] fileBytes, String filename) {
        String originIata = extractIata(filename);
        if (originIata == null) {
            log.warn("No se pudo extraer IATA de: {}", filename);
            sendProgress(0, 0, "ERROR", "Nombre de archivo inválido: " + filename, "???", 0);
            return;
        }

        log.info("Cargando archivo en store: {} (origen: {})", filename, originIata);
        sendProgress(0, 0, "IN_PROGRESS", "Procesando " + filename, originIata, 0);

        int totalLines = countLines(fileBytes);
        List<RawEnvio> parsed  = new ArrayList<>();
        int processed = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ByteArrayInputStream(fileBytes), StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] parts = line.split("-");
                if (parts.length >= 6) {
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
                        parsed.add(new RawEnvio(originIata, destIata, availableFrom, qty));
                    } catch (Exception e) {
                        log.trace("Línea inválida ignorada: {}", line);
                    }
                }
                processed++;

                if (processed % 50_000 == 0) {
                    sendProgress(processed, totalLines, "IN_PROGRESS",
                            "Procesando envíos...", originIata, parsed.size());
                }
            }
        } catch (Exception e) {
            log.error("Error leyendo archivo {}: {}", filename, e.getMessage());
            sendProgress(processed, totalLines, "ERROR", "Error: " + e.getMessage(), originIata, 0);
            return;
        }

        envioStore.merge(parsed);

        log.info("Archivo {} cargado en store: {} registros", filename, parsed.size());
        sendProgress(processed, totalLines, "COMPLETED",
                "Cargado: " + parsed.size() + " envíos", originIata, parsed.size());
    }

    private int countLines(byte[] fileBytes) {
        int count = 0;
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(new ByteArrayInputStream(fileBytes), StandardCharsets.UTF_8))) {
            while (r.readLine() != null) count++;
        } catch (Exception ignored) {}
        return count;
    }

    private String extractIata(String filename) {
        if (filename == null) return null;
        Matcher m = IATA_PATTERN.matcher(filename);
        return m.find() ? m.group(1).toUpperCase() : null;
    }

    private void sendProgress(int processed, int total, String status,
                               String message, String aeropuerto, int inserted) {
        messagingTemplate.convertAndSend(TOPIC,
                new UploadProgressDto(processed, total, status, message, aeropuerto, inserted));
    }
}
