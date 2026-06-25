package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsShipment;
import pe.pucp.tasfb2b.domain.OpsShipmentRoute;
import pe.pucp.tasfb2b.dto.response.OpsReporteResponse;
import pe.pucp.tasfb2b.repository.OpsFlightRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRepository;
import pe.pucp.tasfb2b.repository.OpsShipmentRouteRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OpsReporteService {

    private final OpsFlightRepository        flightRepo;
    private final OpsShipmentRepository      shipmentRepo;
    private final OpsShipmentRouteRepository routeRepo;

    /**
     * Construye el resumen diario para la fecha indicada.
     * Si fecha es null, usa hoy (UTC).
     */
    @Transactional(readOnly = true)
    public OpsReporteResponse buildDailyReport(LocalDate fecha) {

        // ── fecha efectiva: final para poder usarla en lambdas ───────────────
        final LocalDate dia = (fecha != null) ? fecha : LocalDate.now();

        LocalDateTime dayStart = dia.atStartOfDay();
        LocalDateTime dayEnd   = dia.atTime(LocalTime.MAX);

        // ── Vuelos del día ────────────────────────────────────────────────────
        List<OpsFlight> todayFlights = flightRepo.findAll().stream()
                .filter(f -> dia.equals(f.getFlightDate()))
                .collect(Collectors.toList());

        int totalVuelos      = todayFlights.size();
        int vuelosCancelados = (int) todayFlights.stream()
                .filter(f -> "CANCELLED".equals(f.getStatus()))
                .count();
        int vuelosOperados   = (int) todayFlights.stream()
                .filter(f -> "IN_FLIGHT".equals(f.getStatus()) || "LANDED".equals(f.getStatus()))
                .count();

        // IDs de vuelos del día que operaron (para cruzar con rutas)
        Set<Long> operatedFlightIds = todayFlights.stream()
                .filter(f -> "IN_FLIGHT".equals(f.getStatus()) || "LANDED".equals(f.getStatus()))
                .map(OpsFlight::getId)
                .collect(Collectors.toSet());

        // Vuelos del día que tuvieron al menos un envío asignado
        List<OpsShipmentRoute> allRoutes = routeRepo.findAll();

        Set<Long> todayFlightIds = todayFlights.stream()
                .map(OpsFlight::getId)
                .collect(Collectors.toSet());

        Set<Long> flightIdsWithShipments = allRoutes.stream()
                .filter(r -> r.getFlight() != null)
                .filter(r -> todayFlightIds.contains(r.getFlight().getId()))
                .map(r -> r.getFlight().getId())
                .collect(Collectors.toSet());

        int vuelosConEnvios = flightIdsWithShipments.size();

        // ── Ocupación promedio de vuelos operados ──────────────────────────────
        double ocupacionPromedio = 0.0;
        if (!operatedFlightIds.isEmpty()) {
            double sumOcupacion = 0.0;
            for (Long flightId : operatedFlightIds) {
                int bags = allRoutes.stream()
                        .filter(r -> r.getFlight() != null && flightId.equals(r.getFlight().getId()))
                        .mapToInt(r -> r.getShipment() != null ? r.getShipment().getBagCount() : 0)
                        .sum();
                int cap = todayFlights.stream()
                        .filter(f -> flightId.equals(f.getId()))
                        .mapToInt(OpsFlight::getCapacity)
                        .findFirst().orElse(1);
                sumOcupacion += cap > 0 ? (double) bags / cap * 100.0 : 0.0;
            }
            ocupacionPromedio = sumOcupacion / operatedFlightIds.size();
        }

        // ── Envíos registrados ese día ────────────────────────────────────────
        List<OpsShipment> registeredToday = shipmentRepo.findAll().stream()
                .filter(s -> s.getRegisteredAt() != null
                        && !s.getRegisteredAt().isBefore(dayStart)
                        && !s.getRegisteredAt().isAfter(dayEnd))
                .collect(Collectors.toList());

        int enviosRegistrados  = registeredToday.size();
        int maletasRegistradas = registeredToday.stream()
                .mapToInt(OpsShipment::getBagCount)
                .sum();

        // ── Envíos entregados ese día ─────────────────────────────────────────
        List<OpsShipment> deliveredToday = shipmentRepo.findAll().stream()
                .filter(s -> "DELIVERED".equals(s.getStatus())
                        && s.getLastUpdated() != null
                        && !s.getLastUpdated().isBefore(dayStart)
                        && !s.getLastUpdated().isAfter(dayEnd))
                .collect(Collectors.toList());

        int enviosEntregados  = deliveredToday.size();
        int maletasEntregadas = deliveredToday.stream()
                .mapToInt(OpsShipment::getBagCount)
                .sum();

        // ── Envíos retrasados: deadline pasó y no están DELIVERED ─────────────
        LocalDateTime now = LocalDateTime.now();
        int enviosRetrasados = (int) shipmentRepo.findAll().stream()
                .filter(s -> !"DELIVERED".equals(s.getStatus()))
                .filter(s -> s.getDeadlineUtc() != null && s.getDeadlineUtc().isBefore(now))
                .count();

        return OpsReporteResponse.builder()
                .fecha(dia)
                .totalVuelos(totalVuelos)
                .vuelosOperados(vuelosOperados)
                .vuelosCancelados(vuelosCancelados)
                .vuelosConEnvios(vuelosConEnvios)
                .enviosRegistrados(enviosRegistrados)
                .maletasRegistradas(maletasRegistradas)
                .enviosEntregados(enviosEntregados)
                .maletasEntregadas(maletasEntregadas)
                .enviosRetrasados(enviosRetrasados)
                .ocupacionPromedioVuelos(Math.round(ocupacionPromedio * 100.0) / 100.0)
                .build();
    }
}