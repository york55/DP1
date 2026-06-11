package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.dto.response.OpsAirportResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OpsAirportService {

    private final OpsAirportRepository airportRepo;

    public List<OpsAirportResponse> getAll() {
        return airportRepo.findAllAirports().stream()
            .map(a -> new OpsAirportResponse(
                a.getIataCode(),
                a.getName(),
                a.getCountry(),
                a.getContinent(),
                a.getGmtOffset()
            ))
            .toList();
    }
}