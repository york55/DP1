package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.enums.SemaphoreLevel;
import pe.pucp.tasfb2b.dto.response.AirportDto;
import pe.pucp.tasfb2b.dto.response.FlightDto;
import pe.pucp.tasfb2b.mapper.AirportMapper;
import pe.pucp.tasfb2b.mapper.FlightMapper;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AirportService {

    private final AirportRepository airportRepo;
    private final FlightRepository flightRepo;
    private final AirportMapper airportMapper;
    private final FlightMapper flightMapper;

    public List<AirportDto> findAll(double thresholdAmber, double thresholdRed) {
        return airportRepo.findAll().stream()
                .map(a -> toDto(a, thresholdAmber, thresholdRed))
                .collect(Collectors.toList());
    }

    public AirportDto toDto(Airport airport, double thresholdAmber, double thresholdRed) {
        AirportDto dto = airportMapper.toDto(airport);
        dto.setSemaphoreLevel(getSemaphoreLevel(airport.getOccupancyPct(), thresholdAmber, thresholdRed).name());

        List<FlightDto> inbound = flightRepo.findAllWithAirports().stream()
                .filter(f -> f.getDestinationAirport().getId().equals(airport.getId()))
                .map(flightMapper::toDto)
                .collect(Collectors.toList());
        dto.setInboundFlights(inbound);

        List<FlightDto> outbound = flightRepo.findAllWithAirports().stream()
                .filter(f -> f.getOriginAirport().getId().equals(airport.getId()))
                .map(flightMapper::toDto)
                .collect(Collectors.toList());
        dto.setOutboundFlights(outbound);

        return dto;
    }

    public SemaphoreLevel getSemaphoreLevel(double occupancyPct, double thresholdAmber,
                                             double thresholdRed) {
        if (occupancyPct < 25.0) return SemaphoreLevel.LOW;
        if (occupancyPct < 50.0) return SemaphoreLevel.MODERATE;
        if (occupancyPct < thresholdAmber) return SemaphoreLevel.HIGH;
        if (occupancyPct < thresholdRed) return SemaphoreLevel.VERY_HIGH;
        return SemaphoreLevel.CRITICAL;
    }
}
