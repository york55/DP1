package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.KpiSnapshot;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.repository.KpiSnapshotRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class KpiService {

    private final KpiSnapshotRepository kpiSnapshotRepo;

    public List<KpiDto> findBySimulation(Long simulationId) {
        return kpiSnapshotRepo.findBySimulationIdOrderBySnapshotTimeAsc(simulationId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public KpiDto getLatest(Long simulationId) {
        KpiSnapshot snapshot = kpiSnapshotRepo
                .findFirstBySimulationIdOrderBySnapshotTimeDesc(simulationId);
        return snapshot != null ? toDto(snapshot) : null;
    }

    private KpiDto toDto(KpiSnapshot s) {
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
