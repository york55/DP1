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

import org.springframework.data.domain.Sort;
import java.util.List;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

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

    private static final DateTimeFormatter FECHA_FMT      = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FECHA_ARCHIVO   = DateTimeFormatter.ofPattern("yyyyMMdd");
    // Placeholder fijo para IdClien, tal como lo usa el profesor en su data de ejemplo
    // ("se trabaja sólo con uno 0007729, pero no es un dato relevante").
    private static final String ID_CLIEN_PLACEHOLDER = "0007729";

    /**
     * Registra un envío:
     *  1. Persiste en la BD (tabla ops_shipment), incluyendo el cliente ingresado.
     *  2. Escribe la línea en el archivo _envios_<ORIGEN>_.txt
     *     Formato: id_envio-aaaammdd-hh-mm-dest-cantidad-IdClien
     *
     * Si fecha/hora/minuto vienen informados (carga masiva desde archivo),
     * se usan como la hora LOCAL de la sede origen (según su gmtOffset) para
     * calcular el instante real de presentación. Si no vienen (registro manual),
     * se usa la hora actual del servidor, igual que antes.
     *
     * @return El externalId generado (ENV-YYYYMMDD-XXXXXX).
     */
    @Transactional
    public String registrarEnvio(String almacenOrigen,
                                  String almacenDestino,
                                  String cantidadMaletas,
                                  String cliente) throws IOException {
        return registrarEnvio(almacenOrigen, almacenDestino, cantidadMaletas, cliente, null, null, null);
    }

    @Transactional
    public String registrarEnvio(String almacenOrigen,
                                  String almacenDestino,
                                  String cantidadMaletas,
                                  String cliente,
                                  String fecha,
                                  String hora,
                                  String minuto) throws IOException {

        // ── 1. Resolución de aeropuertos ──────────────────────────────────
        OpsAirport origin = airportRepo.findByIataCode(almacenOrigen)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aeropuerto origen no encontrado: " + almacenOrigen));
        OpsAirport dest = airportRepo.findByIataCode(almacenDestino)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aeropuerto destino no encontrado: " + almacenDestino));

        boolean tienePresentacion = fecha != null && !fecha.isBlank()
                && hora != null && !hora.isBlank()
                && minuto != null && !minuto.isBlank();

        // Componentes locales (los que van tal cual al archivo .txt)
        String fechaLocalStr;
        String horaLocalStr;
        String minutoLocalStr;
        // Instante real (usado para persistir en BD y calcular deadline)
        Instant instante;

        if (tienePresentacion) {
            try {
                LocalDate  fechaLocal = LocalDate.parse(fecha, FECHA_FMT);
                LocalTime  horaLocal  = LocalTime.of(Integer.parseInt(hora), Integer.parseInt(minuto));
                int gmtOffset = origin.getGmtOffset() != null ? origin.getGmtOffset() : 0;

                OffsetDateTime presentacionLocal = OffsetDateTime.of(
                        fechaLocal, horaLocal, ZoneOffset.ofHours(gmtOffset));
                instante = presentacionLocal.toInstant();
            } catch (Exception e) {
                throw new IllegalArgumentException(
                    "Fecha/hora de presentación inválida (" + fecha + " " + hora + ":" + minuto + "): " + e.getMessage());
            }
        } else {
            // Registro manual: instante UTC real (independiente de la zona del servidor).
            instante = Instant.now();
        }

        LocalDateTime momentoUtc = LocalDateTime.ofInstant(instante, ZoneOffset.UTC);

        // La hora LOCAL de la sede origen (para el archivo .txt) se deriva SIEMPRE
        // desde el instante real + el gmtOffset del aeropuerto, nunca del reloj
        // del servidor directamente. Así ambos flujos (manual y carga masiva)
        // quedan consistentes entre sí.
        int gmtOffsetOrigen = origin.getGmtOffset() != null ? origin.getGmtOffset() : 0;
        OffsetDateTime localOrigen = instante.atOffset(ZoneOffset.ofHours(gmtOffsetOrigen));
        fechaLocalStr  = localOrigen.format(FECHA_ARCHIVO);
        horaLocalStr   = String.format("%02d", localOrigen.getHour());
        minutoLocalStr = String.format("%02d", localOrigen.getMinute());

        boolean sameContinent = origin.getContinent().equals(dest.getContinent());
        LocalDateTime deadline = sameContinent ? momentoUtc.plusHours(24) : momentoUtc.plusHours(48);

        String dateStr    = momentoUtc.format(FECHA_FMT);
        String uid        = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String externalId = "ENV-" + dateStr + "-" + uid;

        // ── 2. Persistencia en BD ─────────────────────────────────────────
        OpsShipment shipment = new OpsShipment();
        shipment.setExternalId(externalId);
        shipment.setRegisteredAt(momentoUtc);
        shipment.setOriginIata(almacenOrigen);
        shipment.setDestIata(almacenDestino);
        shipment.setBagCount(Integer.parseInt(cantidadMaletas));
        shipment.setClientCode(cliente);
        shipment.setStatus("PENDING");
        shipment.setDeadlineUtc(deadline);
        shipment.setLastUpdated(momentoUtc);

        OpsShipment saved = shipmentRepo.save(shipment);
        log.info("Envío persistido en BD: {} ({} → {}, {} maletas, cliente: {}, deadline UTC: {})",
            externalId, almacenOrigen, almacenDestino, cantidadMaletas, cliente, deadline);

        // ── 3. Escritura en archivo ─────────────────────────────────────
        //   Formato: id_envio-aaaammdd-hh-mm-dest-cantidad-IdClien
        //   Ejemplo: 10000042-20260708-14-30-SEQM-025-0007729
        //   hh-mm y aaaammdd quedan en hora LOCAL de la sede origen (no UTC),
        //   tal como pide el enunciado.
        Path dir     = Paths.get(directorioEnvios);
        Files.createDirectories(dir);
        Path archivo = dir.resolve("_envios_" + almacenOrigen + "_.txt");

        long idEnvioArchivo = 10_000_000L + saved.getId();

        String linea = String.format("%d-%s-%s-%s-%s-%s-%s",
                idEnvioArchivo, fechaLocalStr, horaLocalStr, minutoLocalStr,
                almacenDestino, cantidadMaletas, ID_CLIEN_PLACEHOLDER);

        try (BufferedWriter writer = Files.newBufferedWriter(
                archivo,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND)) {
            writer.write(linea);
            writer.newLine();
        }

        log.info("Envío escrito en archivo: {}", linea);
        return externalId;
    }

    // ─────────────────────────────────────────────────────────────────────────
	
	public List<OpsShipment> listarEnvios() {
		return shipmentRepo.findAll(Sort.by(Sort.Direction.DESC, "registeredAt"));
	}
}