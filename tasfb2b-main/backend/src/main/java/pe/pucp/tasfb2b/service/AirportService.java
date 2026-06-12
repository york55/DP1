package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.enums.SemaphoreLevel;
import pe.pucp.tasfb2b.dto.request.AirportRequest;
import pe.pucp.tasfb2b.dto.response.AirportDto;
import pe.pucp.tasfb2b.dto.response.FlightDto;
import pe.pucp.tasfb2b.mapper.AirportMapper;
import pe.pucp.tasfb2b.mapper.FlightMapper;
import pe.pucp.tasfb2b.repository.AirportRepository;
import pe.pucp.tasfb2b.repository.FlightRepository;

import java.util.List;
import java.util.Optional;
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

    public AirportDto findById(Long id, double thresholdAmber, double thresholdRed) {
        Airport airport = airportRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto con ID " + id + " no encontrado"));
        return toDto(airport, thresholdAmber, thresholdRed);
    }

    public AirportDto create(AirportRequest req, double thresholdAmber, double thresholdRed) {
        // Verificar unicidad del código IATA
        Optional<Airport> existing = airportRepo.findByIataCode(req.getIataCode().toUpperCase());
        if (existing.isPresent()) {
            throw new IllegalArgumentException(
                    "Ya existe un aeropuerto con el código IATA '" + req.getIataCode().toUpperCase() + "'");
        }

        Airport airport = new Airport();
        applyRequestToEntity(req, airport);
        Airport saved = airportRepo.save(airport);
        return toDto(saved, thresholdAmber, thresholdRed);
    }

    public AirportDto update(Long id, AirportRequest req, double thresholdAmber, double thresholdRed) {
        Airport airport = airportRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto con ID " + id + " no encontrado"));

        // Verificar que el nuevo código IATA no colisione con otro aeropuerto
        Optional<Airport> duplicate = airportRepo.findByIataCode(req.getIataCode().toUpperCase());
        if (duplicate.isPresent() && !duplicate.get().getId().equals(id)) {
            throw new IllegalArgumentException(
                    "Ya existe otro aeropuerto con el código IATA '" + req.getIataCode().toUpperCase() + "'");
        }

        applyRequestToEntity(req, airport);
        Airport saved = airportRepo.save(airport);
        return toDto(saved, thresholdAmber, thresholdRed);
    }

    public void delete(Long id) {
        Airport airport = airportRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto con ID " + id + " no encontrado"));

        // Verificar que no tenga vuelos asociados
        long flightCount = flightRepo.findAllWithAirports().stream()
                .filter(f -> f.getOriginAirport().getId().equals(id)
                        || f.getDestinationAirport().getId().equals(id))
                .count();
        if (flightCount > 0) {
            throw new IllegalArgumentException(
                    "No se puede eliminar el aeropuerto '" + airport.getIataCode()
                    + "' porque tiene " + flightCount + " vuelos asociados");
        }

        airportRepo.delete(airport);
    }

    private void applyRequestToEntity(AirportRequest req, Airport airport) {
        airport.setIataCode(req.getIataCode().toUpperCase());
        airport.setCity(req.getCity());
        airport.setCountry(req.getCountry());
        airport.setContinent(req.getContinent());
        airport.setWarehouseCapacity(req.getWarehouseCapacity());
        airport.setGmtOffset(req.getGmtOffset());
        airport.setLatitude(req.getLatitude());
        airport.setLongitude(req.getLongitude());
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

