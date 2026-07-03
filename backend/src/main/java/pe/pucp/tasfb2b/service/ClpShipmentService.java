package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.Airline;
import pe.pucp.tasfb2b.domain.ClpAirport;
import pe.pucp.tasfb2b.domain.ClpBaggageBatch;
import pe.pucp.tasfb2b.domain.enums.BatchStatus;
import pe.pucp.tasfb2b.repository.AirlineRepository;
import pe.pucp.tasfb2b.repository.ClpAirportRepository;
import pe.pucp.tasfb2b.repository.ClpBaggageBatchRepository;
import pe.pucp.tasfb2b.simulation.EnvioStore;
import pe.pucp.tasfb2b.simulation.RawEnvio;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Materializes RawEnvio records from the shared EnvioStore into
 * the Clp_baggage_batches table for the collapse simulation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClpShipmentService {

    private final ClpBaggageBatchRepository batchRepo;
    private final ClpAirportRepository airportRepo;
    private final AirlineRepository airlineRepo;
    private final EnvioStore envioStore;

    @Transactional
    public int materializeBatchesFromStore(LocalDateTime from, LocalDateTime to) {
        if (!envioStore.isLoaded()) {
            log.warn("[CLP] EnvioStore no cargado — sin envíos para materializar");
            return 0;
        }

        List<RawEnvio> envios = envioStore.queryRange(from, to);
        if (envios.isEmpty()) {
            log.info("[CLP] Sin envíos en el rango {} → {}", from, to);
            return 0;
        }

        Airline airline = airlineRepo.findAll().stream().findFirst().orElse(null);
        if (airline == null) {
            log.error("[CLP] No hay aerolíneas registradas");
            return 0;
        }

        Map<String, ClpAirport> cache = new HashMap<>();
        List<ClpBaggageBatch> buffer = new ArrayList<>(1000);
        int inserted = 0;

        for (RawEnvio envio : envios) {
            ClpAirport origin = cache.computeIfAbsent(envio.getOriginIata(),
                    k -> airportRepo.findByIataCode(k).orElse(null));
            ClpAirport dest = cache.computeIfAbsent(envio.getDestinationIata(),
                    k -> airportRepo.findByIataCode(k).orElse(null));

            if (origin != null && dest != null) {
                ClpBaggageBatch batch = new ClpBaggageBatch();
                batch.setAirline(airline);
                batch.setOriginAirport(origin);
                batch.setDestinationAirport(dest);
                batch.setQuantity(envio.getQuantity());
                batch.setAvailableFrom(envio.getAvailableFrom());
                batch.setStatus(BatchStatus.IN_ORIGIN);
                buffer.add(batch);
                inserted++;
            }

            if (buffer.size() >= 1000) {
                batchRepo.saveAll(buffer);
                buffer.clear();
            }
        }

        if (!buffer.isEmpty()) {
            batchRepo.saveAll(buffer);
        }

        log.info("[CLP] Materializados {} batches desde store ({} → {})", inserted, from, to);
        return inserted;
    }
}
