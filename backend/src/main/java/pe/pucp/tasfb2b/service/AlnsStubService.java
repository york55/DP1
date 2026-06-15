package pe.pucp.tasfb2b.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.ActiveFlight;
import pe.pucp.tasfb2b.domain.PendingShipment;

import java.util.List;

@Service
@Slf4j
public class AlnsStubService {

    public void reoptimize(List<ActiveFlight> vuelos, List<PendingShipment> envios) {
        log.info("[ALNS-STUB] Reoptimizando: {} vuelos activos, {} envíos pendientes",
                vuelos.stream().filter(v -> !v.isCancelled()).count(),
                envios.size());
        // TODO: implementar ALNS real aquí
    }
}