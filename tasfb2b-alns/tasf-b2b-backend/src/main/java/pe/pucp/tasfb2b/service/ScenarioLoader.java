package pe.pucp.tasfb2b.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import pe.pucp.tasfb2b.domain.*;
import pe.pucp.tasfb2b.domain.enums.Continent;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ScenarioLoader {

    private static final Logger log = LoggerFactory.getLogger(ScenarioLoader.class);

    public Scenario loadScenario(MultipartFile aeropuertosFile, MultipartFile vuelosFile, MultipartFile enviosFile, MultipartFile parametrosFile, Integer maxBags) throws Exception {
        log.debug("Iniciando carga de escenario...");

        Map<String, Airport> aeropuertos = parseAeropuertos(aeropuertosFile);
        log.info("  Aeropuertos parseados: {}", aeropuertos.size());

        List<Flight> vuelos = parseVuelos(vuelosFile);
        log.info("  Vuelos parseados: {}", vuelos.size());

        List<Shipment> envios = parseEnvios(enviosFile, maxBags);
        log.info("  Envios parseados: {}", envios.size());

        Scenario scenario = parseParametros(parametrosFile, aeropuertos, vuelos, envios);
        log.info("  Parametros: periodo={} dias, semilla={}, w1={}, w2={}, w3={}",
                scenario.periodoDias(), scenario.semillaAleatoria(), scenario.w1(), scenario.w2(), scenario.w3());

        return scenario;
    }

    private Map<String, Airport> parseAeropuertos(MultipartFile file) throws Exception {
        Map<String, Airport> map = new HashMap<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            boolean first = true;
            int lineNum = 0;
            while ((line = br.readLine()) != null) {
                lineNum++;
                if (first) { first = false; log.debug("  [aeropuertos] Header: {}", line); continue; }
                if(line.trim().isEmpty()) continue;
                try {
                    String[] p = line.split(",");
                    map.put(p[0].trim(), new Airport(
                        p[0].trim(), p[1].trim(), p[2].trim(), Continent.valueOf(p[3].trim().toUpperCase()),
                        Double.parseDouble(p[4].trim()), Double.parseDouble(p[5].trim()),
                        Integer.parseInt(p[6].trim()), Integer.parseInt(p[7].trim())
                    ));
                } catch (Exception e) {
                    log.error("  [aeropuertos] Error en linea {}: '{}' -> {}", lineNum, line, e.getMessage());
                    throw e;
                }
            }
        }
        return map;
    }

    private List<Flight> parseVuelos(MultipartFile file) throws Exception {
        List<Flight> list = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            boolean first = true;
            int lineNum = 0;
            while ((line = br.readLine()) != null) {
                lineNum++;
                if (first) { first = false; log.debug("  [vuelos] Header: {}", line); continue; }
                if(line.trim().isEmpty()) continue;
                try {
                    String[] p = line.split(",");
                    list.add(new Flight(
                        p[0].trim(), p[1].trim(), p[2].trim(),
                        Instant.parse(p[3].trim()), Instant.parse(p[4].trim()),
                        Integer.parseInt(p[5].trim()), Boolean.parseBoolean(p[6].trim())
                    ));
                } catch (Exception e) {
                    log.error("  [vuelos] Error en linea {}: '{}' -> {}", lineNum, line, e.getMessage());
                    throw e;
                }
            }
        }
        return list;
    }

    private List<Shipment> parseEnvios(MultipartFile file, Integer maxBags) throws Exception {
        List<Shipment> list = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            boolean first = true;
            int lineNum = 0;
            while ((line = br.readLine()) != null) {
                if (maxBags != null && list.size() >= maxBags) break;
                lineNum++;
                if (first) { first = false; log.debug("  [envios] Header: {}", line); continue; }
                if(line.trim().isEmpty()) continue;
                try {
                    String[] p = line.split(",");
                    int cantidad = Integer.parseInt(p[4].trim());
                    Instant disponibilidad = Instant.parse(p[5].trim());
                    String baseId = p[0].trim();
                    for (int i = 0; i < cantidad; i++) {
                        if (maxBags != null && list.size() >= maxBags) break;
                        list.add(new Shipment(
                            baseId + "_" + i, p[1].trim(), p[2].trim(), p[3].trim(),
                            1, disponibilidad
                        ));
                    }
                } catch (Exception e) {
                    log.error("  [envios] Error en linea {}: '{}' -> {}", lineNum, line, e.getMessage());
                    throw e;
                }
            }
        }
        return list;
    }

    private Scenario parseParametros(MultipartFile file, Map<String, Airport> aeropuertos, List<Flight> vuelos, List<Shipment> envios) throws Exception {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            boolean first = true;
            int lineNum = 0;
            while ((line = br.readLine()) != null) {
                lineNum++;
                if (first) { first = false; log.debug("  [parametros] Header: {}", line); continue; }
                if(line.trim().isEmpty()) continue;
                try {
                    String[] p = line.split(",");
                    log.debug("  [parametros] Linea {}: campos={}, contenido='{}'", lineNum, p.length, line);
                    double w1 = p.length > 4 && !p[4].trim().isEmpty() ? Double.parseDouble(p[4].trim()) : 0.5;
                    double w2 = p.length > 5 && !p[5].trim().isEmpty() ? Double.parseDouble(p[5].trim()) : 0.2;
                    double w3 = p.length > 6 && !p[6].trim().isEmpty() ? Double.parseDouble(p[6].trim()) : 0.3;

                    int periodoDias = Integer.parseInt(p[0].trim());
                    Instant fechaInicioUtc = Instant.parse(p[1].trim());

                    record FlightPattern(String iataOrigen, String iataDestino, java.time.LocalTime horaSalida, java.time.LocalTime horaLlegada, int capacidadMaletas) {}
                    java.util.Set<FlightPattern> patterns = new java.util.HashSet<>();
                    for (Flight v : vuelos) {
                        java.time.LocalDateTime ldtSalida = java.time.LocalDateTime.ofInstant(v.horaSalidaUtc(), java.time.ZoneOffset.UTC);
                        java.time.LocalDateTime ldtLlegada = java.time.LocalDateTime.ofInstant(v.horaLlegadaUtc(), java.time.ZoneOffset.UTC);
                        patterns.add(new FlightPattern(v.iataOrigen(), v.iataDestino(), ldtSalida.toLocalTime(), ldtLlegada.toLocalTime(), v.capacidadMaletas()));
                    }

                    List<Flight> projectedVuelos = new java.util.ArrayList<>();
                    if (vuelos != null && !vuelos.isEmpty()) {
                        int flightIdCounter = 1;
                        java.time.LocalDate startLocalDate = java.time.LocalDateTime.ofInstant(fechaInicioUtc, java.time.ZoneOffset.UTC).toLocalDate();

                        for (int day = 0; day < periodoDias; day++) {
                            java.time.LocalDate currentDay = startLocalDate.plusDays(day);
                            for (FlightPattern pat : patterns) {
                                java.time.LocalDateTime ldtSalida = currentDay.atTime(pat.horaSalida());
                                java.time.LocalDateTime ldtLlegada = currentDay.atTime(pat.horaLlegada());
                                
                                if (ldtLlegada.isBefore(ldtSalida)) {
                                    ldtLlegada = ldtLlegada.plusDays(1);
                                }
                                
                                Instant instantSalida = ldtSalida.toInstant(java.time.ZoneOffset.UTC);
                                Instant instantLlegada = ldtLlegada.toInstant(java.time.ZoneOffset.UTC);
                                
                                projectedVuelos.add(new Flight(
                                    String.format("V%06d", flightIdCounter++),
                                    pat.iataOrigen(), pat.iataDestino(),
                                    instantSalida, instantLlegada,
                                    pat.capacidadMaletas(), false
                                ));
                            }
                        }
                    } else {
                        projectedVuelos = vuelos;
                    }

                    return new Scenario(
                        aeropuertos, projectedVuelos, envios,
                        periodoDias, fechaInicioUtc,
                        Long.parseLong(p[2].trim()), p[3].trim(),
                        w1, w2, w3
                    );
                } catch (Exception e) {
                    log.error("  [parametros] Error en linea {}: '{}' -> {}", lineNum, line, e.getMessage());
                    throw e;
                }
            }
        }
        throw new RuntimeException("Parametros invalidos: archivo vacio o sin datos");
    }
}
