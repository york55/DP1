package pe.pucp.tasfb2b.mapper;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Shipment;
import pe.pucp.tasfb2b.dto.response.ShipmentDto;

@Component
public class ShipmentMapper {

    public ShipmentDto toDto(Shipment s) {
        ShipmentDto dto = new ShipmentDto();
        dto.setId(s.getId());
        dto.setStatus(s.getStatus().name());
        dto.setDeadline(s.getDeadline());
        dto.setDeliveredAt(s.getDeliveredAt());
        dto.setCreatedAt(s.getCreatedAt());

        if (s.getBaggageBatch() != null) {
            var batch = s.getBaggageBatch();
            dto.setBatchId(batch.getId());
            dto.setQuantity(batch.getQuantity());
            dto.setOriginIata(batch.getOriginAirport().getIataCode());
            dto.setDestinationIata(batch.getDestinationAirport().getIataCode());
            if (batch.getAirline() != null) {
                dto.setAirline(batch.getAirline().getIataCode());
            }
        }

        return dto;
    }

    public ShipmentDto batchToDto(pe.pucp.tasfb2b.domain.BaggageBatch b) {
        ShipmentDto dto = new ShipmentDto();
        dto.setId(b.getId());
        dto.setBatchId(b.getId());
        dto.setStatus(b.getStatus().name());
        dto.setQuantity(b.getQuantity());
        if (b.getOriginAirport() != null) dto.setOriginIata(b.getOriginAirport().getIataCode());
        if (b.getDestinationAirport() != null) dto.setDestinationIata(b.getDestinationAirport().getIataCode());
        if (b.getAirline() != null) dto.setAirline(b.getAirline().getIataCode());
        dto.setCreatedAt(b.getCreatedAt());
        return dto;
    }
}
