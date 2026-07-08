package pe.pucp.tasfb2b.mapper;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.ClpSimulation;
import pe.pucp.tasfb2b.dto.response.ClpSimulationDto;
import pe.pucp.tasfb2b.dto.response.KpiDto;

@Component
public class ClpSimulationMapper {

    public ClpSimulationDto toDto(ClpSimulation s, KpiDto currentKpi) {
        ClpSimulationDto dto = new ClpSimulationDto();
        dto.setId(s.getId());
        dto.setScenarioType(s.getScenarioType().name());
        dto.setStartDate(s.getStartDate());
        dto.setStatus(s.getStatus().name());
        dto.setAlgorithm(s.getAlgorithm());
        dto.setCancellationRate(s.getCancellationRate().doubleValue());
        dto.setSeed(s.getSeed());
        dto.setVolumePerDay(s.getVolumePerDay());
        dto.setSimulatedTime(s.getSimulatedTime());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setCurrentKpi(currentKpi);
        dto.setDaysSimulated(s.getDaysSimulated());
        dto.setCollapsedAt(s.getCollapsedAt());
        dto.setCollapsedAirportIata(
                s.getCollapsedAirport() != null ? s.getCollapsedAirport().getIataCode() : null);
        return dto;
    }
}
