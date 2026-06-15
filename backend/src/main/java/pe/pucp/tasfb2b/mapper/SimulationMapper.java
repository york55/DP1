package pe.pucp.tasfb2b.mapper;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.Simulation;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.dto.response.SimulationDto;

@Component
public class SimulationMapper {

    public SimulationDto toDto(Simulation s, KpiDto currentKpi) {
        SimulationDto dto = new SimulationDto();
        dto.setId(s.getId());
        dto.setScenarioType(s.getScenarioType().name());
        dto.setPeriodDays(s.getPeriodDays());
        dto.setStartDate(s.getStartDate());
        dto.setStatus(s.getStatus().name());
        dto.setAlgorithm(s.getAlgorithm());
        dto.setCancellationRate(s.getCancellationRate().doubleValue());
        dto.setSeed(s.getSeed());
        dto.setVolumePerDay(s.getVolumePerDay());
        dto.setSimulatedTime(s.getSimulatedTime());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setCurrentKpi(currentKpi);
        return dto;
    }
}
