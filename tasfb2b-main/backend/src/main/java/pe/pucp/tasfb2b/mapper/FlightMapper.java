package pe.pucp.tasfb2b.mapper;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.dto.response.FlightDto;

@Component
public class FlightMapper {

    public FlightDto toDto(Flight f) {
        FlightDto dto = new FlightDto();
        dto.setId(f.getId());
        dto.setOriginIata(f.getOriginAirport().getIataCode());
        dto.setDestinationIata(f.getDestinationAirport().getIataCode());
        dto.setOriginLat(f.getOriginAirport().getLatitude().doubleValue());
        dto.setOriginLon(f.getOriginAirport().getLongitude().doubleValue());
        dto.setDestinationLat(f.getDestinationAirport().getLatitude().doubleValue());
        dto.setDestinationLon(f.getDestinationAirport().getLongitude().doubleValue());
        dto.setDepartureTime(f.getDepartureTime());
        dto.setArrivalTime(f.getArrivalTime());
        dto.setBaggageCapacity(f.getBaggageCapacity());
        dto.setCurrentLoad(f.getCurrentLoad());
        dto.setFrequency(f.getFrequency());
        dto.setStatus(f.getStatus().name());
        dto.setProgress(0.0);
        if (f.getAirline() != null) {
            dto.setAirlineName(f.getAirline().getName());
            dto.setAirlineIata(f.getAirline().getIataCode());
        }
        return dto;
    }
}
