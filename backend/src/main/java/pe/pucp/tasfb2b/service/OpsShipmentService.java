package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.dto.request.OpsShipmentRequest;
import pe.pucp.tasfb2b.dto.response.OpsShipmentResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpsShipmentService {

    private final OpsShipmentRepository shipmentRepo;
    private final OpsAirportRepository  airportRepo;

    @Transactional
    public OpsShipmentResponse register(OpsShipmentRequest req) {
        LocalDateTime now = LocalDateTime.now();

        OpsAirport origin = airportRepo.findByIataCode(req.getAlmacenOrigen())
            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto origen no encontrado: " + req.getAlmacenOrigen()));
        OpsAirport dest = airportRepo.findByIataCode(req.getAlmacenDestino())
            .orElseThrow(() -> new IllegalArgumentException("Aeropuerto destino no encontrado: " + req.getAlmacenDestino()));

        boolean sameContinent = origin.getContinent().equals(dest.getContinent());
        LocalDateTime deadline = sameContinent ? now.plusHours(24) : now.plusHours(48);

        String dateStr   = now.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uid       = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String externalId = "ENV-" + dateStr + "-" + uid;

        OpsShipment shipment = new OpsShipment();
        shipment.setExternalId(externalId);
        shipment.setRegisteredAt(now);
        shipment.setOriginIata(req.getAlmacenOrigen());
        shipment.setDestIata(req.getAlmacenDestino());
        shipment.setBagCount(Integer.parseInt(req.getCantidadMaletas()));
        shipment.setClientCode(req.getCliente());
        shipment.setStatus("PENDING");
        shipment.setDeadlineUtc(deadline);
        shipment.setLastUpdated(now);

        OpsShipment saved = shipmentRepo.save(shipment);
        log.info("Envío registrado: {} ({} → {}, {} maletas, cliente: {}, deadline: {})",
            externalId, req.getAlmacenOrigen(), req.getAlmacenDestino(),
            req.getCantidadMaletas(), req.getCliente(), deadline);

        return toResponse(saved);
    }

    private OpsShipmentResponse toResponse(OpsShipment s) {
        return new OpsShipmentResponse(
            s.getId(),
            s.getExternalId(),
            s.getOriginIata(),
            s.getDestIata(),
            s.getBagCount(),
            s.getClientCode(),
            s.getStatus(),
            s.getRegisteredAt(),
            s.getDeadlineUtc(),
			s.getLastUpdated(),
            java.util.List.of()
        );
    }
}
