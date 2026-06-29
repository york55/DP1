package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.ScenarioType;
import pe.pucp.tasfb2b.domain.enums.SimulationStatus;
import pe.pucp.tasfb2b.dto.request.CreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.KpiDto;
import pe.pucp.tasfb2b.dto.response.SimulationDto;
import pe.pucp.tasfb2b.exception.SimulationNotFoundException;
import pe.pucp.tasfb2b.mapper.SimulationMapper;
import pe.pucp.tasfb2b.repository.*;
import pe.pucp.tasfb2b.simulation.BlockOrchestrator;
import pe.pucp.tasfb2b.simulation.EnvioStore;
import pe.pucp.tasfb2b.simulation.SimulationEngine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationService {

    private final SimulationRepository simulationRepo;
    private final FlightRepository flightRepo;
    private final FlightCancellationRepository cancellationRepo;
    private final ShipmentRepository shipmentRepo;
    private final BaggageBatchRepository batchRepo;
    private final AirportRepository airportRepo;
    private final SimulationEngine simulationEngine;
    private final BlockOrchestrator blockOrchestrator;
    private final KpiService kpiService;
    private final SimulationMapper simulationMapper;
    private final EnvioStore envioStore;

    private final RouteRepository routeRepo;
    private final RouteLegRepository routeLegRepo;
    private final ShipmentStatusHistoryRepository shipmentStatusHistoryRepo;
    private final KpiSnapshotRepository kpiSnapshotRepo;

    @Transactional
    public SimulationDto createSimulation(CreateSimulationRequest req) {
        Simulation sim = new Simulation();
        sim.setScenarioType(ScenarioType.valueOf(req.getScenarioType()));
        sim.setPeriodDays(req.getPeriodDays());
        sim.setStartDate(req.getStartDate());
        sim.setCancellationRate(BigDecimal.valueOf(req.getCancellationRate()));
        sim.setSeed(req.getSeed());
        sim.setVolumePerDay(req.getVolumePerDay());
        sim.setAlgorithm(req.getAlgorithm() != null ? req.getAlgorithm() : "ALNS");
        sim.setStatus(SimulationStatus.CONFIGURED);

        if (req.getAlnsParams() != null) {
            var ap = req.getAlnsParams();
            sim.setT0(ap.getT0());
            sim.setAlphaSa(ap.getAlpha());
            sim.setQPct(ap.getQPct());
            sim.setMaxIterations(ap.getMaxIterations());
        }

        Simulation saved = simulationRepo.save(sim);
        log.info("Simulación creada: id={}, tipo={}, período={}días, algoritmo={}",
                saved.getId(), saved.getScenarioType(), saved.getPeriodDays(), saved.getAlgorithm());

        return simulationMapper.toDto(saved, null);
    }

    public SimulationDto getSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));
        KpiDto kpi = kpiService.getLatest(id);
        return simulationMapper.toDto(sim, kpi);
    }

    @Transactional
    public SimulationDto startSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        if (sim.getStatus() != SimulationStatus.CONFIGURED) {
            throw new IllegalArgumentException("La simulación no puede iniciarse en estado: " + sim.getStatus());
        }

        resetForSimulation(sim);
        sim.setStatus(SimulationStatus.BUFFERING);
        simulationRepo.save(sim);
        simulationEngine.initSimulation(id);

        // Launch the block pipeline after this transaction commits
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.start(id);
            }
        });

        log.info("Simulación {} iniciada — pipeline de bloques arrancando", id);
        return simulationMapper.toDto(sim, null);
    }

    @Transactional
    public SimulationDto pauseSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        blockOrchestrator.pause(id);
        sim.setStatus(SimulationStatus.PAUSED);
        simulationRepo.save(sim);

        log.info("Simulación {} pausada", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationDto resumeSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        if (sim.getStatus() != SimulationStatus.PAUSED) {
            throw new IllegalArgumentException("Solo se puede reanudar una simulación pausada");
        }

        sim.setStatus(SimulationStatus.PLAYING);
        simulationRepo.save(sim);

        // Resume orchestrator only after DB commit so tick() sees PLAYING
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                blockOrchestrator.resume(id);
            }
        });

        log.info("Simulación {} reanudada", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationDto stopSimulation(Long id) {
        Simulation sim = simulationRepo.findById(id)
                .orElseThrow(() -> new SimulationNotFoundException(id));

        blockOrchestrator.stop(id);
        simulationEngine.removeState(id);
        sim.setStatus(SimulationStatus.FINISHED);
        simulationRepo.save(sim);

        log.info("Simulación {} detenida", id);
        return simulationMapper.toDto(sim, kpiService.getLatest(id));
    }

    @Transactional
    public SimulationEngine.ManualCancelResult manualCancelFlight(Long simulationId, Long flightId) {
        return simulationEngine.manualCancelFlight(flightId, simulationId);
    }

    public List<SimulationDto> findAll() {
        return simulationRepo.findAll().stream()
                .map(s -> simulationMapper.toDto(s, null))
                .toList();
    }

    private void resetForSimulation(Simulation sim) {
        // 1. Delete in FK-safe order: history → route_legs → routes → shipments
        shipmentStatusHistoryRepo.deleteAllInBatch();
        long legCount = routeLegRepo.count();
        routeLegRepo.deleteAllInBatch();
        long routeCount = routeRepo.count();
        routeRepo.deleteAllInBatch();
        long shipmentCount = shipmentRepo.count();
        shipmentRepo.deleteAllInBatch();
        log.info("Eliminados {} route_legs, {} routes, {} shipments para simulación {}",
                legCount, routeCount, shipmentCount, sim.getId());

        // 2. Reset airport occupancies
        airportRepo.resetAllOccupancies();

        // 3. Delete instance flights from any previous run (cancellations first due to FK)
        List<Flight> instances = flightRepo.findByFrequency("INSTANCE");
        if (!instances.isEmpty()) {
            cancellationRepo.deleteByFlightIdIn(instances.stream().map(Flight::getId).toList());
            flightRepo.deleteAllInstances();
            log.info("Eliminadas {} instancias de vuelo de la ejecución anterior", instances.size());
        }

        // 4. Reset template flights (frequency=DAILY) to their initial state
        List<Flight> templates = flightRepo.findByFrequency("DAILY");
        cancellationRepo.deleteByFlightIdIn(templates.stream().map(Flight::getId).toList());
        templates.forEach(f -> { f.setStatus(FlightStatus.SCHEDULED); f.setCurrentLoad(0); });
        flightRepo.saveAll(templates);
        log.info("Reset {} vuelos plantilla para simulación {}", templates.size(), sim.getId());

        // 5. Expand daily itineraries into per-day instances for the full simulation period
        expandFlightsForSimulation(sim, templates);
    }

    private static final LocalDate FLIGHT_TEMPLATE_DATE = LocalDate.of(2026, 5, 10);

    private void expandFlightsForSimulation(Simulation sim, List<Flight> templates) {
        if (templates.isEmpty()) return;
        LocalDate simStart = sim.getStartDate().toLocalDate();
        int periodDays = sim.getPeriodDays() != null ? sim.getPeriodDays() : 5;
        long baseOffset = ChronoUnit.DAYS.between(FLIGHT_TEMPLATE_DATE, simStart);

        List<Flight> instances = new ArrayList<>();
        for (int day = 0; day < periodDays; day++) {
            // Day 0 when simStart == template date: use templates directly (they ARE day-0 flights)
            if (day == 0 && baseOffset == 0) continue;
            long totalOffset = baseOffset + day;
            for (Flight tmpl : templates) {
                Flight inst = new Flight();
                inst.setOriginAirport(tmpl.getOriginAirport());
                inst.setDestinationAirport(tmpl.getDestinationAirport());
                inst.setDepartureTime(tmpl.getDepartureTime().plusDays(totalOffset));
                inst.setArrivalTime(tmpl.getArrivalTime().plusDays(totalOffset));
                inst.setBaggageCapacity(tmpl.getBaggageCapacity());
                inst.setFrequency("INSTANCE");
                inst.setStatus(FlightStatus.SCHEDULED);
                inst.setAirline(tmpl.getAirline());
                instances.add(inst);
            }
        }
        if (!instances.isEmpty()) {
            flightRepo.saveAll(instances);
            log.info("Expandidos {} vuelos instancia para simulación {} ({} plantillas × {} días)",
                    instances.size(), sim.getId(), templates.size(), periodDays - (baseOffset == 0 ? 1 : 0));
        }
    }

    @Transactional
    public void hardReset() {
        log.info("ACTION hard_reset limpiando BD para nueva simulación");

        // Detener simulaciones activas si las hay
        blockOrchestrator.pause(0L); // Optional, might not do anything if id=0, but safe. 

        // 1. Eliminar historial y patas de ruta para liberar dependencias
        shipmentStatusHistoryRepo.deleteAllInBatch();
        routeLegRepo.deleteAllInBatch();
        routeRepo.deleteAllInBatch();

        // 2. Eliminar Shipments
        shipmentRepo.deleteAllInBatch();

        // 3. Eliminar BaggageBatches antiguos
        batchRepo.deleteAllInBatch();

        // 4. Eliminar KPIs y cancelaciones
        kpiSnapshotRepo.deleteAllInBatch();
        cancellationRepo.deleteAllInBatch();

        // 5. Eliminar simulaciones
        simulationRepo.deleteAllInBatch();

        // 6. Reset Airport
        airportRepo.resetAllOccupancies();

        // 7. Eliminar vuelos instanciados (frequency=INSTANCE) generados por simulaciones anteriores
        flightRepo.deleteAllInstances();

        // 8. Reset vuelos plantilla (frequency=DAILY) a estado inicial
        List<Flight> templates = flightRepo.findByFrequency("DAILY");
        for (Flight f : templates) {
            f.setStatus(FlightStatus.SCHEDULED);
            f.setCurrentLoad(0);
        }
        flightRepo.saveAll(templates);

        // 9. Limpiar el store en memoria de envíos crudos
        envioStore.clear();

        log.info("ACTION hard_reset COMPLETADO");
    }
}