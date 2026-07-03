package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.FlightStatus;
import pe.pucp.tasfb2b.domain.enums.ShipmentStatus;
import pe.pucp.tasfb2b.planner.OptimizationResult;
import pe.pucp.tasfb2b.planner.SimulationContext;
import pe.pucp.tasfb2b.planner.alns.AlnsEngine;
import pe.pucp.tasfb2b.planner.alns.AlnsParams;
import pe.pucp.tasfb2b.planner.PlanProgressSnapshot;
import pe.pucp.tasfb2b.repository.*;

import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Wraps the existing AlnsEngine for the Collapse simulation.
 * Converts ClpFlight/ClpBaggageBatch/ClpAirport ↔ Flight/BaggageBatch/Airport
 * so the algorithm runs unchanged, then persists results to Clp_ tables.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClpPlannerService {

    @Value("${tasf.alns.default-t0:100.0}")
    private double defaultT0;
    @Value("${tasf.alns.default-alpha:0.9995}")
    private double defaultAlpha;
    @Value("${tasf.alns.default-q-pct:0.25}")
    private double defaultQPct;
    @Value("${tasf.alns.default-max-iterations:80}")
    private int defaultMaxIterations;
    @Value("${tasf.alns.default-seg-len:20}")
    private int defaultSegLen;

    private final AlnsEngine alnsEngine;
    private final ClpRouteRepository clpRouteRepo;
    private final ClpRouteLegRepository clpRouteLegRepo;
    private final ClpShipmentRepository clpShipmentRepo;
    private final ClpFlightRepository clpFlightRepo;
    private final ClpBaggageBatchRepository clpBatchRepo;

    // ── Bridge: Clp entities → detached domain entities for AlnsEngine ──────

    public static Airport toAirport(ClpAirport ca) {
        Airport a = new Airport();
        a.setId(ca.getId());
        a.setIataCode(ca.getIataCode());
        a.setCity(ca.getCity());
        a.setCountry(ca.getCountry());
        a.setContinent(ca.getContinent());
        a.setWarehouseCapacity(ca.getWarehouseCapacity());
        a.setCurrentOccupancy(ca.getCurrentOccupancy());
        a.setGmtOffset(ca.getGmtOffset());
        a.setLatitude(ca.getLatitude());
        a.setLongitude(ca.getLongitude());
        return a;
    }

    public static Flight toFlight(ClpFlight cf, Map<Long, Airport> airportBridge) {
        Flight f = new Flight();
        f.setId(cf.getId());
        f.setAirline(cf.getAirline());
        f.setOriginAirport(airportBridge.get(cf.getOriginAirport().getId()));
        f.setDestinationAirport(airportBridge.get(cf.getDestinationAirport().getId()));
        f.setDepartureTime(cf.getDepartureTime());
        f.setArrivalTime(cf.getArrivalTime());
        f.setBaggageCapacity(cf.getBaggageCapacity());
        f.setCurrentLoad(cf.getCurrentLoad());
        f.setFrequency(cf.getFrequency());
        f.setStatus(cf.getStatus());
        return f;
    }

    public static BaggageBatch toBatch(ClpBaggageBatch cb, Map<Long, Airport> airportBridge) {
        BaggageBatch b = new BaggageBatch();
        b.setId(cb.getId());
        b.setAirline(cb.getAirline());
        b.setOriginAirport(airportBridge.get(cb.getOriginAirport().getId()));
        b.setDestinationAirport(airportBridge.get(cb.getDestinationAirport().getId()));
        b.setQuantity(cb.getQuantity());
        b.setAvailableFrom(cb.getAvailableFrom());
        b.setStatus(cb.getStatus());
        return b;
    }

    // ── Plan ─────────────────────────────────────────────────────────────────

    @Transactional
    public OptimizationResult plan(List<ClpAirport> clpAirports,
                                    List<ClpFlight> clpFlights,
                                    List<ClpBaggageBatch> clpBatches,
                                    java.time.LocalDateTime simulatedNow,
                                    AlnsParams alnsParams,
                                    Consumer<PlanProgressSnapshot> progressCallback) {

        Map<Long, Airport> airportBridge = clpAirports.stream()
                .collect(Collectors.toMap(ClpAirport::getId, ClpPlannerService::toAirport));

        List<Airport> airports = new ArrayList<>(airportBridge.values());
        List<Flight> flights = clpFlights.stream()
                .map(cf -> toFlight(cf, airportBridge))
                .collect(Collectors.toList());
        List<BaggageBatch> batches = clpBatches.stream()
                .map(cb -> toBatch(cb, airportBridge))
                .collect(Collectors.toList());

        SimulationContext ctx = SimulationContext.builder()
                .airports(airports)
                .flights(flights)
                .pendingBatches(batches)
                .simulatedNow(simulatedNow)
                .alnsParams(alnsParams)
                .progressCallback(progressCallback)
                .build();

        log.info("[CLP] Planificando {} lotes con {} vuelos", batches.size(), flights.size());
        OptimizationResult result = alnsEngine.optimize(ctx);
        persistClpRoutes(result);
        return result;
    }

    @Transactional
    public OptimizationResult replan(List<ClpBaggageBatch> affectedClp,
                                      List<ClpAirport> clpAirports,
                                      List<ClpFlight> clpFlights,
                                      java.time.LocalDateTime simulatedNow,
                                      AlnsParams alnsParams) {

        Map<Long, Airport> airportBridge = clpAirports.stream()
                .collect(Collectors.toMap(ClpAirport::getId, ClpPlannerService::toAirport));

        List<Flight> flights = clpFlights.stream()
                .map(cf -> toFlight(cf, airportBridge))
                .collect(Collectors.toList());
        List<BaggageBatch> affected = affectedClp.stream()
                .map(cb -> toBatch(cb, airportBridge))
                .collect(Collectors.toList());

        SimulationContext ctx = SimulationContext.builder()
                .airports(new ArrayList<>(airportBridge.values()))
                .flights(flights)
                .pendingBatches(affected)
                .simulatedNow(simulatedNow)
                .alnsParams(alnsParams)
                .build();

        OptimizationResult result = alnsEngine.replan(affected, ctx);
        persistClpRoutes(result);
        return result;
    }

    // ── Persist: Route/Shipment/RouteLeg → Clp equivalents ──────────────────

    private void persistClpRoutes(OptimizationResult result) {
        if (result.routes().isEmpty()) return;

        List<ClpShipment> shipments = new ArrayList<>();
        List<ClpRoute> routes = new ArrayList<>();
        List<ClpRouteLeg> allLegs = new ArrayList<>();

        for (Route route : result.routes()) {
            Long batchId = route.getShipment().getBaggageBatch().getId();
            ClpBaggageBatch clpBatch = clpBatchRepo.findById(batchId).orElse(null);
            if (clpBatch == null) continue;

            ClpShipment cs = new ClpShipment();
            cs.setBaggageBatch(clpBatch);
            cs.setDeadline(route.getShipment().getDeadline());
            cs.setStatus(ShipmentStatus.PLANNED);
            shipments.add(cs);
        }
        List<ClpShipment> savedShipments = clpShipmentRepo.saveAll(shipments);

        int idx = 0;
        for (Route route : result.routes()) {
            if (idx >= savedShipments.size()) break;
            ClpShipment savedShipment = savedShipments.get(idx++);

            ClpRoute cr = new ClpRoute();
            cr.setShipment(savedShipment);
            cr.setTotalLegs(route.getTotalLegs());
            cr.setAlgorithmUsed(route.getAlgorithmUsed());
            cr.setEstimatedArrival(route.getEstimatedArrival());
            routes.add(cr);
        }
        List<ClpRoute> savedRoutes = clpRouteRepo.saveAll(routes);

        idx = 0;
        for (Route route : result.routes()) {
            if (idx >= savedRoutes.size()) break;
            ClpRoute savedRoute = savedRoutes.get(idx++);

            for (RouteLeg leg : route.getLegs()) {
                Long flightId = leg.getFlight().getId();
                ClpFlight clpFlight = clpFlightRepo.findById(flightId).orElse(null);
                if (clpFlight == null) continue;

                ClpRouteLeg cl = new ClpRouteLeg();
                cl.setRoute(savedRoute);
                cl.setFlight(clpFlight);
                cl.setLegOrder(leg.getLegOrder());
                allLegs.add(cl);
            }
        }
        clpRouteLegRepo.saveAll(allLegs);
    }

    public AlnsParams buildAlnsParams(ClpSimulation sim) {
        AlnsParams defaults = AlnsParams.defaults();
        return new AlnsParams(
                sim.getT0() != null ? sim.getT0() : defaultT0,
                sim.getAlphaSa() != null ? sim.getAlphaSa() : defaultAlpha,
                sim.getQPct() != null ? sim.getQPct() : defaultQPct,
                sim.getMaxIterations() != null ? sim.getMaxIterations() : defaultMaxIterations,
                defaultSegLen, defaults.sigma1(), defaults.sigma2(), defaults.sigma3(),
                defaults.rho(), defaults.pNoise(), defaults.w1(), defaults.w2(), defaults.w3(),
                defaults.w4(), defaults.w5(), defaults.kRegret(), defaults.connectMinGapMinutes(),
                defaults.maxHops()
        );
    }
}
