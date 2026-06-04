package pe.pucp.tasfb2b.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.ActiveFlight;
import pe.pucp.tasfb2b.domain.PendingShipment;

import java.io.File;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DayStateService {

    private final FlightPlanLoader loader;
    private final AlnsStubService alnsStub;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final File STATE_FILE = new File("state.json");

    @Getter
    private final List<ActiveFlight> vuelosActivos = Collections.synchronizedList(new ArrayList<>());

    @Getter
    private final List<PendingShipment> enviosPorEnviar = Collections.synchronizedList(new ArrayList<>());

    private static final Map<String, Integer> GMT_OFFSET = Map.ofEntries(
        Map.entry("SKBO", -5), Map.entry("SEQM", -5), Map.entry("SVMI", -4),
        Map.entry("SBBR", -3), Map.entry("SPIM", -5), Map.entry("SLLP", -4),
        Map.entry("SCEL", -3), Map.entry("SABE", -3), Map.entry("SGAS", -4),
        Map.entry("SUAA", -3), Map.entry("LATI", +2), Map.entry("EDDI", +2),
        Map.entry("LOWW", +2), Map.entry("EBCI", +2), Map.entry("UMMS", +3),
        Map.entry("LBSF", +3), Map.entry("LKPR", +2), Map.entry("LDZA", +2),
        Map.entry("EKCH", +2), Map.entry("EHAM", +2), Map.entry("VIDP", +5),
        Map.entry("OSDI", +3), Map.entry("OERK", +3), Map.entry("OMDB", +4),
        Map.entry("OAKB", +4), Map.entry("OOMS", +4), Map.entry("OYSN", +3),
        Map.entry("OPKC", +5), Map.entry("UBBB", +2), Map.entry("OJAI", +3)
    );

    // ── Estructura del JSON ───────────────────────────────────────────────────────

    // Lo que se guarda en state.json
    static class PersistedState {
        public Set<String> cancelledFlightKeys = new HashSet<>();
        public List<PersistedShipment> shipments = new ArrayList<>();
    }

    static class PersistedShipment {
        public String shipmentId;
        public String origin;
        public String destination;
        public int quantity;
    }

    // ── Arranque ──────────────────────────────────────────────────────────────────

    @PostConstruct
    public void init() {
        // 1. Carga el plan de vuelos base (como siempre)
        List<ActiveFlight> loaded = loader.load();
        vuelosActivos.addAll(loaded);
        log.info("DayStateService: {} vuelos cargados desde planes_vuelo.txt", loaded.size());

        // 2. Aplica el estado persistido encima
        if (STATE_FILE.exists()) {
            try {
                PersistedState state = objectMapper.readValue(STATE_FILE, PersistedState.class);

                // Restaurar cancelaciones
                synchronized (vuelosActivos) {
                    for (ActiveFlight f : vuelosActivos) {
                        if (state.cancelledFlightKeys.contains(f.getFlightKey())) {
                            f.setCancelled(true);
                            f.setCancelledUntil(f.getDepartureLocal());
                            log.info("Vuelo {} restaurado como cancelado", f.getFlightKey());
                        }
                    }
                }

                // Restaurar envíos
                for (PersistedShipment s : state.shipments) {
                    enviosPorEnviar.add(new PendingShipment(s.shipmentId, s.origin, s.destination, s.quantity));
                }
                log.info("Estado restaurado: {} cancelaciones, {} envíos",
                        state.cancelledFlightKeys.size(), state.shipments.size());

            } catch (Exception e) {
                log.warn("No se pudo leer state.json, arrancando limpio: {}", e.getMessage());
            }
        }
    }

    // ── Persistencia ─────────────────────────────────────────────────────────────

    private void saveState() {
        try {
            PersistedState state = new PersistedState();

            synchronized (vuelosActivos) {
                for (ActiveFlight f : vuelosActivos) {
                    if (f.isCancelled()) {
                        state.cancelledFlightKeys.add(f.getFlightKey());
                    }
                }
            }

            for (PendingShipment s : enviosPorEnviar) {
                PersistedShipment ps = new PersistedShipment();
                ps.shipmentId   = s.getShipmentId();
                ps.origin       = s.getOrigin();
                ps.destination  = s.getDestination();
                ps.quantity     = s.getQuantity();
                state.shipments.add(ps);
            }

            objectMapper.writerWithDefaultPrettyPrinter().writeValue(STATE_FILE, state);
            log.debug("state.json guardado ({} cancelados, {} envíos)",
                    state.cancelledFlightKeys.size(), state.shipments.size());

        } catch (Exception e) {
            log.error("Error guardando state.json: {}", e.getMessage());
        }
    }

    // ── Cancelación ──────────────────────────────────────────────────────────────

    public boolean cancelFlight(String flightKey) {
        synchronized (vuelosActivos) {
            for (ActiveFlight f : vuelosActivos) {
                if (f.getFlightKey().equals(flightKey) && !f.isCancelled()) {
                    f.setCancelled(true);
                    f.setCancelledUntil(f.getDepartureLocal());
                    log.info("Vuelo {} cancelado hasta las {} hora local", flightKey, f.getDepartureLocal());
                    saveState();
                    alnsStub.reoptimize(vuelosActivos, enviosPorEnviar);
                    return true;
                }
            }
        }
        return false;
    }

    @Scheduled(fixedRate = 60_000)
    public void reactivateFlights() {
        LocalTime nowUtc = ZonedDateTime.now(ZoneOffset.UTC).toLocalTime();
        boolean changed = false;

        synchronized (vuelosActivos) {
            for (ActiveFlight f : vuelosActivos) {
                if (!f.isCancelled()) continue;
                int offset = GMT_OFFSET.getOrDefault(f.getOrigin(), 0);
                LocalTime nowLocal = nowUtc.plusHours(offset);
                if (nowLocal.isAfter(f.getCancelledUntil())) {
                    f.setCancelled(false);
                    f.setCancelledUntil(null);
                    log.info("Vuelo {} reactivado automáticamente", f.getFlightKey());
                    changed = true;
                }
            }
        }

        // Si se reactivó algo, persiste el nuevo estado
        if (changed) saveState();
    }

    // ── Envíos ───────────────────────────────────────────────────────────────────

    public void addShipment(PendingShipment shipment) {
        enviosPorEnviar.add(shipment);
        log.info("Envío agregado: {} → {} ({} maletas)",
                shipment.getOrigin(), shipment.getDestination(), shipment.getQuantity());
        saveState();
        alnsStub.reoptimize(vuelosActivos, enviosPorEnviar);
    }

    public LocalTime toUtc(String iataCode, LocalTime localTime) {
        int offset = GMT_OFFSET.getOrDefault(iataCode, 0);
        return localTime.minusHours(offset);
    }
}