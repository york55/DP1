package pe.pucp.tasfb2b.mapper;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.dto.response.AirportDto;

@Component
public class AirportMapper {

    public AirportDto toDto(Airport a) {
        AirportDto dto = new AirportDto();
        dto.setId(a.getId());
        dto.setIata(a.getIataCode());
        dto.setCity(a.getCity());
        dto.setCountry(a.getCountry());
        dto.setContinent(a.getContinent());
        dto.setWarehouseCapacity(a.getWarehouseCapacity());
        dto.setCurrentOccupancy(a.getCurrentOccupancy());
        dto.setOccupancyPct(a.getOccupancyPct());
        dto.setLatitude(a.getLatitude().doubleValue());
        dto.setLongitude(a.getLongitude().doubleValue());
        return dto;
    }
}
