package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsFlightPlan;
import pe.pucp.tasfb2b.dto.response.ActiveFlightResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsFlightPlanRepository;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpsFlightPlanService {

    private final OpsFlightPlanRepository flightRepo;
    private final OpsAirportRepository    airportRepo;

    public List<ActiveFlightResponse> getAllFlights() {
        Map<String, Integer> offsets = airportRepo.findAllAirports().stream()
            .collect(Collectors.toMap(OpsAirport::getIataCode, OpsAirport::getGmtOffset));

        List<OpsFlightPlan> raw = flightRepo.findAllOrderByDeparture();
        log.info("Vuelos encontrados en BD: {}", raw.size());

        return raw.stream()
            .map(f -> toResponse(f, offsets))
            .toList();
    }

    @Transactional
	public boolean cancelFlight(Long id) {
		int updated = flightRepo.cancelById(id);
		if (updated > 0) log.info("Vuelo id={} cancelado", id);
		return updated > 0;
	}

    private ActiveFlightResponse toResponse(OpsFlightPlan f, Map<String, Integer> offsets) {
        int originOffset = offsets.getOrDefault(f.getOriginIata(), 0);
        int destOffset   = offsets.getOrDefault(f.getDestIata(),   0);

        LocalTime depUtc = f.getDepTimeLocal().minusHours(originOffset);
        LocalTime arrUtc = f.getArrTimeLocal().minusHours(destOffset);

        return new ActiveFlightResponse(
            f.getId(),
            f.getOriginIata(),
            f.getDestIata(),
            depUtc.toString(),
            arrUtc.toString(),
            f.getDepTimeLocal().toString(),
            f.getArrTimeLocal().toString(),
            f.getCapacity(),
            !f.getIsActive()
        );
    }
}