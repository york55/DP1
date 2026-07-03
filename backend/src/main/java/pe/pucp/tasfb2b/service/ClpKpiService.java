package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.ClpKpiSnapshot;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.repository.ClpKpiSnapshotRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClpKpiService {

    private final ClpKpiSnapshotRepository kpiSnapshotRepo;

    public List<KpiDto> findBySimulation(Long simulationId) {
        return kpiSnapshotRepo.findBySimulationIdOrderBySnapshotTimeAsc(simulationId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public KpiDto getLatest(Long simulationId) {
        ClpKpiSnapshot snapshot = kpiSnapshotRepo
                .findFirstBySimulationIdOrderBySnapshotTimeDesc(simulationId);
        return snapshot != null ? toDto(snapshot) : null;
    }

    private KpiDto toDto(ClpKpiSnapshot s) {
        KpiDto dto = new KpiDto();
        dto.setId(s.getId());
        dto.setSnapshotTime(s.getSnapshotTime());
        dto.setOnTimePct(s.getOnTimePct().doubleValue());
        dto.setDelayedCount(s.getDelayedCount());
        dto.setAvgFlightOccupancy(s.getAvgFlightOccupancy().doubleValue());
        dto.setAvgWarehouseOccupancy(s.getAvgWarehouseOccupancy().doubleValue());
        return dto;
    }
}
