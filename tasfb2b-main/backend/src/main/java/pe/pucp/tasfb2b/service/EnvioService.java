package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnvioService {

    // ── BD ──────────────────────────────────────────────────────────────────
    private final OpsShipmentRepository shipmentRepo;
    private final OpsAirportRepository  airportRepo;

    // ── Archivo ──────────────────────────────────────────────────────────────
    @Value("${envios.directorio:./envios}")
    private String directorioEnvios;

    private static final DateTimeFormatter FECHA_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter HORA_FMT  = DateTimeFormatter.ofPattern("HH-mm");

    /**
     * Registra un envío:
     *  1. Persiste en la BD (tabla ops_shipment).
     *  2. Escribe la línea en el archivo _envios_<ORIGEN>_.txt.
     *
     * @return La línea completa escrita en el archivo (igual que antes).
     */
    @Transactional
    public String registrarEnvio(String almacenOrigen,
                                  String almacenDestino,
                                  String cantidadMaletas) throws IOException {

        LocalDateTime now = LocalDateTime.now();

        // ── 1. Persistencia en BD ─────────────────────────────────────────
        OpsAirport origin = airportRepo.findByIataCode(almacenOrigen)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aeropuerto origen no encontrado: " + almacenOrigen));
        OpsAirport dest = airportRepo.findByIataCode(almacenDestino)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aeropuerto destino no encontrado: " + almacenDestino));

        boolean sameContinent = origin.getContinent().equals(dest.getContinent());
        LocalDateTime deadline = sameContinent ? now.plusHours(24) : now.plusHours(48);

        String dateStr    = now.format(FECHA_FMT);
        String uid        = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String externalId = "ENV-" + dateStr + "-" + uid;

        OpsShipment shipment = new OpsShipment();
        shipment.setExternalId(externalId);
        shipment.setRegisteredAt(now);
        shipment.setOriginIata(almacenOrigen);
        shipment.setDestIata(almacenDestino);
        shipment.setBagCount(Integer.parseInt(cantidadMaletas));
        shipment.setStatus("PENDING");
        shipment.setDeadlineUtc(deadline);
        shipment.setLastUpdated(now);

        OpsShipment saved = shipmentRepo.save(shipment);
        log.info("Envío persistido en BD: {} ({} → {}, {} maletas, deadline: {})",
            externalId, almacenOrigen, almacenDestino, cantidadMaletas, deadline);

        // ── 2. Escritura en archivo ───────────────────────────────────────
        Path dir     = Paths.get(directorioEnvios);
        Files.createDirectories(dir);
        Path archivo = dir.resolve("_envios_" + almacenOrigen + "_.txt");

        long proximoId = calcularProximoId(archivo);
        String fecha   = now.format(FECHA_FMT);
        String hora    = now.format(HORA_FMT);
        String idCliente = generarIdCliente(proximoId);

        // Formato: 000000001-20260102-06-30-SEQM-025-0012500
        String linea = String.format("%09d-%s-%s-%s-%s-%s",
                proximoId, fecha, hora, almacenDestino, cantidadMaletas, idCliente);

        try (BufferedWriter writer = Files.newBufferedWriter(
                archivo,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND)) {
            writer.write(linea);
            writer.newLine();
        }

        log.info("Envío escrito en archivo: {}", linea);
        return linea;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers (sin cambios respecto a la versión original)
    // ─────────────────────────────────────────────────────────────────────────

    private long calcularProximoId(Path archivo) throws IOException {
        if (!Files.exists(archivo)) return 1L;
        List<String> lineas = Files.readAllLines(archivo, StandardCharsets.UTF_8);
        for (int i = lineas.size() - 1; i >= 0; i--) {
            String linea = lineas.get(i).trim();
            if (!linea.isEmpty()) {
                String[] partes = linea.split("-");
                if (partes.length > 0) {
                    try { return Long.parseLong(partes[0]) + 1; }
                    catch (NumberFormatException ignored) {}
                }
            }
        }
        return 1L;
    }

    private String generarIdCliente(long idEnvio) {
        return String.format("%07d", idEnvio * 500L);
    }
	
	public List<OpsShipment> listarEnvios() {
		return shipmentRepo.findAll(Sort.by(Sort.Direction.DESC, "registeredAt"));
	}
}