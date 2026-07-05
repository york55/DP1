package pe.pucp.tasfb2b.planner.alns.repair;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;
import pe.pucp.tasfb2b.planner.alns.DeadlineUtil;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

public class RegretKInsertion implements RepairOperator {

    // ── Costo lexicográfico: puntual SIEMPRE gana a tardío ────────────────────
    // Cualquier candidato que llega DENTRO del deadline SLA le gana a cualquier candidato
    // tardío, sin importar cuánta espera en tierra implique. Antes la penalización era
    // 5 pts/min de atraso contra 1 pt/min de espera: una ruta que llegaba 10 min tarde
    // (costo 50) le ganaba a una puntual que esperaba 100 min para embarcar — exactamente
    // lo contrario del objetivo de "cero retrasos".
    private static final double LATE_BASE_PENALTY = 1_000_000.0;
    private static final double LATE_PENALTY_PER_MINUTE = 10.0;

    // Entre candidatos puntuales se prefiere levemente el de menos escalas (cada escala
    // extra ocupa capacidad de un vuelo más y pasa por un almacén más).
    private static final double HOP_PENALTY_MINUTES = 15.0;

    // Tope de candidatos cacheados por lote (se conservan los mejores por costo estático).
    private static final int MAX_CACHED_CANDIDATES = 40;

    private final int connectMinGapMinutes;
    private final int maxHops;

    // ── Caché de rutas candidatas por lote ────────────────────────────────────
    // El costo de un candidato es ESTÁTICO: depende solo de horarios, gaps y deadline del
    // lote — nada de eso cambia durante la búsqueda ALNS. Lo único dinámico es la capacidad
    // remanente de cada vuelo, que se verifica con canAssign() al momento de usar el
    // candidato. Antes, cada iteración del ALNS re-enumeraba TODAS las conexiones de 1 y 2
    // escalas para cada lote del banco (O(F_origen × F_hub) por lote por iteración); con la
    // caché ese trabajo se paga UNA sola vez por corrida, lo que permite subir maxIterations
    // sin disparar el tiempo de cómputo.
    // El engine crea una instancia nueva de este operador por cada optimize()/replan(), así
    // que la caché nunca sobrevive a un cambio de ventana de vuelos.
    private Map<Long, List<Candidate>> candidateCache;
    // Por lote: conjunto de TODOS los vuelos que aparecen en sus candidatos cacheados.
    // Se usa para la recomputación incremental del regret en repair().
    private Map<Long, Set<Long>> footprintCache;

    private record Candidate(List<Long> flightIds, double staticCost) {}

    public RegretKInsertion(int connectMinGapMinutes, int maxHops) {
        this.connectMinGapMinutes = connectMinGapMinutes;
        this.maxHops = maxHops;
    }

    public RegretKInsertion(int connectMinGapMinutes) {
        this(connectMinGapMinutes, 2);
    }

    public RegretKInsertion() {
        this(30, 2);
    }

    @Override
    public void repair(AlnsSolution solution, List<BaggageBatch> allBatches,
                       List<Flight> availableFlights, int kRegret, Random rng) {

        Map<String, List<Flight>> flightsByOrigin = availableFlights.stream()
                .collect(Collectors.groupingBy(f -> f.getOriginAirport().getIataCode()));

        if (candidateCache == null) {
            candidateCache = buildCandidateCache(allBatches, flightsByOrigin);
            footprintCache = buildFootprintCache();
        }

        Set<Long> bankSnapshot = new LinkedHashSet<>(solution.getBank());

        // Recomputación INCREMENTAL del regret: insertar un lote solo cambia la capacidad
        // de los (≤3) vuelos de su ruta, así que solo hay que re-evaluar los lotes cuyo
        // "footprint" de candidatos toca alguno de esos vuelos. Antes se recalculaba el
        // regret de TODO el banco tras CADA inserción — O(banco² × candidatos) por repair,
        // que a escala de miles de lotes por bloque domina el tiempo total.
        Map<Long, Double> regretOf = new HashMap<>();
        Map<Long, List<Long>> chosenOf = new HashMap<>();
        for (Long batchId : bankSnapshot) {
            computeEntry(batchId, kRegret, flightsByOrigin, solution, regretOf, chosenOf);
        }

        while (!bankSnapshot.isEmpty()) {
            Long bestBatchId = null;
            double bestRegret = Double.NEGATIVE_INFINITY;
            for (Long batchId : bankSnapshot) {
                double regret = regretOf.getOrDefault(batchId, Double.NEGATIVE_INFINITY);
                if (regret > bestRegret) {
                    bestRegret = regret;
                    bestBatchId = batchId;
                }
            }
            if (bestBatchId == null) break;

            List<Long> bestFlightSequence = chosenOf.get(bestBatchId);
            bankSnapshot.remove(bestBatchId);
            regretOf.remove(bestBatchId);
            chosenOf.remove(bestBatchId);

            if (bestFlightSequence != null) {
                solution.assign(bestBatchId, bestFlightSequence);
                // Solo los lotes que podrían usar alguno de los vuelos recién cargados
                // necesitan re-evaluarse.
                for (Long other : bankSnapshot) {
                    Set<Long> footprint = footprintCache.getOrDefault(other, Collections.emptySet());
                    for (Long fid : bestFlightSequence) {
                        if (footprint.contains(fid)) {
                            computeEntry(other, kRegret, flightsByOrigin, solution, regretOf, chosenOf);
                            break;
                        }
                    }
                }
            }
        }
    }

    private void computeEntry(Long batchId, int kRegret,
                               Map<String, List<Flight>> flightsByOrigin,
                               AlnsSolution solution,
                               Map<Long, Double> regretOf, Map<Long, List<Long>> chosenOf) {
        BaggageBatch batch = solution.getBatchMap().get(batchId);
        if (batch == null) {
            regretOf.put(batchId, Double.NEGATIVE_INFINITY);
            chosenOf.put(batchId, null);
            return;
        }
        List<Candidate> feasible = feasibleCandidates(batchId, batch, flightsByOrigin, solution);

        if (feasible.isEmpty()) {
            regretOf.put(batchId, Double.MAX_VALUE);
            chosenOf.put(batchId, null);
        } else if (feasible.size() == 1) {
            regretOf.put(batchId, feasible.get(0).staticCost() + 10000.0);
            chosenOf.put(batchId, feasible.get(0).flightIds());
        } else {
            double cost0 = feasible.get(0).staticCost();
            int idx = Math.min(kRegret - 1, feasible.size() - 1);
            double costK = feasible.get(idx).staticCost();
            // Con el costo lexicográfico, un lote cuya mejor opción es puntual pero cuya
            // k-ésima ya es tardía obtiene un regret enorme (~LATE_BASE_PENALTY) y se
            // inserta primero, protegiendo su último cupo puntual antes de que otro lote
            // con más alternativas se lo lleve.
            regretOf.put(batchId, costK - cost0);
            chosenOf.put(batchId, feasible.get(0).flightIds());
        }
    }

    private Map<Long, Set<Long>> buildFootprintCache() {
        Map<Long, Set<Long>> footprints = new HashMap<>(candidateCache.size() * 2);
        for (Map.Entry<Long, List<Candidate>> e : candidateCache.entrySet()) {
            Set<Long> fp = new HashSet<>();
            for (Candidate c : e.getValue()) {
                fp.addAll(c.flightIds());
            }
            footprints.put(e.getKey(), fp);
        }
        return footprints;
    }

    // ── Selección de candidatos factibles (capacidad) ─────────────────────────

    private List<Candidate> feasibleCandidates(Long batchId, BaggageBatch batch,
                                                Map<String, List<Flight>> flightsByOrigin,
                                                AlnsSolution solution) {
        List<Candidate> cached = candidateCache.getOrDefault(batchId, Collections.emptyList());

        // Caché vacía = no existe NINGUNA ruta origen→destino con estos vuelos (la caché se
        // genera sin mirar capacidad, así que es un superconjunto de lo factible). No tiene
        // sentido buscar dinámicamente.
        if (cached.isEmpty()) return Collections.emptyList();

        int qty = batch.getQuantity();
        List<Candidate> feasible = new ArrayList<>();
        for (Candidate c : cached) {
            if (allLegsFit(c.flightIds(), qty, solution)) {
                feasible.add(c);
            }
        }
        if (!feasible.isEmpty()) return feasible;

        // Los MAX_CACHED_CANDIDATES mejores están todos llenos: búsqueda dinámica completa
        // (con capacidad) como red de seguridad, igual que hacía la versión anterior en cada
        // iteración. Es un camino raro (solo con la red muy saturada), no el caso común.
        return findCandidatesDynamic(batch, flightsByOrigin, solution);
    }

    private boolean allLegsFit(List<Long> flightIds, int qty, AlnsSolution solution) {
        for (Long fid : flightIds) {
            if (!solution.canAssign(fid, qty)) return false;
        }
        return true;
    }

    // ── Construcción de la caché (sin capacidad, una vez por corrida) ─────────

    private Map<Long, List<Candidate>> buildCandidateCache(List<BaggageBatch> batches,
                                                            Map<String, List<Flight>> flightsByOrigin) {
        Map<Long, List<Candidate>> cache = new HashMap<>(batches.size() * 2);
        for (BaggageBatch batch : batches) {
            cache.put(batch.getId(), generateCandidates(batch, flightsByOrigin, null));
        }
        return cache;
    }

    /**
     * Genera las secuencias candidatas para un lote. Si {@code solution} es null la
     * generación ignora capacidad (modo caché); si no, filtra con canAssign (modo dinámico).
     */
    private List<Candidate> generateCandidates(BaggageBatch batch,
                                                Map<String, List<Flight>> flightsByOrigin,
                                                AlnsSolution solution) {
        String origin = batch.getOriginAirport().getIataCode();
        String dest = batch.getDestinationAirport().getIataCode();
        int qty = batch.getQuantity();
        LocalDateTime availableFrom = batch.getAvailableFrom();
        LocalDateTime deadline = DeadlineUtil.computeDeadline(batch);

        List<Candidate> candidates = new ArrayList<>();
        List<Flight> departingOrigin = flightsByOrigin.getOrDefault(origin, Collections.emptyList());

        // Vuelos directos
        for (Flight f : departingOrigin) {
            if (!f.getDestinationAirport().getIataCode().equals(dest)) continue;
            if (f.getDepartureTime().isBefore(availableFrom)) continue;
            if (solution != null && !solution.canAssign(f.getId(), qty)) continue;
            candidates.add(makeCandidate(List.of(f), availableFrom, deadline));
        }

        // Conexiones de 1 escala (2 tramos)
        if (maxHops >= 2) {
            for (Flight f1 : departingOrigin) {
                if (f1.getDepartureTime().isBefore(availableFrom)) continue;
                if (solution != null && !solution.canAssign(f1.getId(), qty)) continue;
                String hub = f1.getDestinationAirport().getIataCode();
                if (hub.equals(dest)) continue;

                for (Flight f2 : flightsByOrigin.getOrDefault(hub, Collections.emptyList())) {
                    if (!f2.getDestinationAirport().getIataCode().equals(dest)) continue;
                    if (solution != null && !solution.canAssign(f2.getId(), qty)) continue;
                    long gap = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                    if (gap < connectMinGapMinutes) continue;
                    candidates.add(makeCandidate(List.of(f1, f2), availableFrom, deadline));
                }
            }
        }

        // Conexiones de 2 escalas (3 tramos): solo cuando NO existe ninguna opción directa
        // ni de 1 escala — cubre pares origen-destino que de otra forma quedarían atrapados
        // en el banco para siempre, sin pagar el costo combinatorio del tercer salto en el
        // caso común.
        if (maxHops >= 3 && candidates.isEmpty()) {
            for (Flight f1 : departingOrigin) {
                if (f1.getDepartureTime().isBefore(availableFrom)) continue;
                if (solution != null && !solution.canAssign(f1.getId(), qty)) continue;
                String hub1 = f1.getDestinationAirport().getIataCode();
                if (hub1.equals(dest) || hub1.equals(origin)) continue;

                for (Flight f2 : flightsByOrigin.getOrDefault(hub1, Collections.emptyList())) {
                    String hub2 = f2.getDestinationAirport().getIataCode();
                    if (hub2.equals(origin) || hub2.equals(hub1)) continue;
                    if (solution != null && !solution.canAssign(f2.getId(), qty)) continue;
                    long gap1 = Duration.between(f1.getArrivalTime(), f2.getDepartureTime()).toMinutes();
                    if (gap1 < connectMinGapMinutes) continue;

                    for (Flight f3 : flightsByOrigin.getOrDefault(hub2, Collections.emptyList())) {
                        if (!f3.getDestinationAirport().getIataCode().equals(dest)) continue;
                        if (solution != null && !solution.canAssign(f3.getId(), qty)) continue;
                        long gap2 = Duration.between(f2.getArrivalTime(), f3.getDepartureTime()).toMinutes();
                        if (gap2 < connectMinGapMinutes) continue;
                        candidates.add(makeCandidate(List.of(f1, f2, f3), availableFrom, deadline));
                    }
                }
            }
        }

        candidates.sort(Comparator.comparingDouble(Candidate::staticCost));
        if (candidates.size() > MAX_CACHED_CANDIDATES) {
            return new ArrayList<>(candidates.subList(0, MAX_CACHED_CANDIDATES));
        }
        return candidates;
    }

    private List<Candidate> findCandidatesDynamic(BaggageBatch batch,
                                                   Map<String, List<Flight>> flightsByOrigin,
                                                   AlnsSolution solution) {
        return generateCandidates(batch, flightsByOrigin, solution);
    }

    // ── Costo estático de una secuencia ───────────────────────────────────────

    private Candidate makeCandidate(List<Flight> legs, LocalDateTime availableFrom,
                                     LocalDateTime deadline) {
        Flight first = legs.get(0);
        Flight last = legs.get(legs.size() - 1);

        // Tiempo total en tierra: espera en origen + gaps de conexión en cada hub. Cada
        // minuto en tierra es un minuto de maletas ocupando un almacén (origen o hub), que
        // es la variable que empuja al colapso por ocupación — por eso se minimiza el
        // tiempo en tierra COMPLETO y no solo la espera para embarcar.
        long groundMin = Math.max(0, Duration.between(availableFrom,
                first.getDepartureTime()).toMinutes());
        for (int i = 1; i < legs.size(); i++) {
            groundMin += Math.max(0, Duration.between(legs.get(i - 1).getArrivalTime(),
                    legs.get(i).getDepartureTime()).toMinutes());
        }

        long lateMin = Duration.between(deadline, last.getArrivalTime()).toMinutes();

        double cost;
        if (lateMin > 0) {
            cost = LATE_BASE_PENALTY + lateMin * LATE_PENALTY_PER_MINUTE;
        } else {
            cost = groundMin + HOP_PENALTY_MINUTES * (legs.size() - 1);
        }

        List<Long> ids = new ArrayList<>(legs.size());
        for (Flight f : legs) ids.add(f.getId());
        return new Candidate(ids, cost);
    }

    // ── Pase de rescate por eyección ──────────────────────────────────────────
    // Escenario objetivo (el observado en la simulación: un envío de 8 maletas tardío con
    // los almacenes llenos): las rutas puntuales del lote SÍ existen, pero sus vuelos están
    // ocupados por lotes que tienen otras alternativas puntuales. La búsqueda estocástica
    // puede o no encontrar el intercambio; este pase lo hace determinísticamente:
    // por cada lote víctima (tardío o sin asignar), por cada ruta puntual candidata, intenta
    // liberar los tramos bloqueados moviendo a los bloqueadores a rutas puntuales propias
    // que NO usen el vuelo bloqueado. Todo con snapshot/rollback: si no se logra completar
    // la jugada, la solución queda exactamente como estaba. Nunca crea un tardío nuevo.

    private static final int EJECTION_BUDGET_PER_ATTEMPT = 6;

    @Override
    public int rescue(AlnsSolution solution) {
        if (candidateCache == null) return 0;

        List<Long> victims = new ArrayList<>();
        for (Long id : solution.getAssignedBatchIds()) {
            if (solution.getLatenessMinutes(id) > 0) victims.add(id);
        }
        victims.addAll(solution.getBank());

        int rescued = 0;
        for (Long victimId : victims) {
            BaggageBatch victim = solution.getBatchMap().get(victimId);
            if (victim == null) continue;
            if (tryRescueOne(victimId, victim.getQuantity(), solution)) rescued++;
        }
        return rescued;
    }

    private boolean tryRescueOne(Long victimId, int qty, AlnsSolution solution) {
        List<Candidate> cands = candidateCache.getOrDefault(victimId, Collections.emptyList());
        for (Candidate cand : cands) {
            // La caché está ordenada por costo: al llegar al primer tardío ya no hay
            // candidatos puntuales que probar.
            if (cand.staticCost() >= LATE_BASE_PENALTY) break;

            AlnsSolution.Snapshot snap = solution.snapshot();
            if (tryPlaceWithEjection(victimId, qty, cand, solution)) {
                return true;
            }
            solution.restore(snap);
        }
        return false;
    }

    private boolean tryPlaceWithEjection(Long victimId, int qty, Candidate cand,
                                          AlnsSolution solution) {
        if (!solution.getAssignment(victimId).isEmpty()) {
            solution.unassign(victimId);
        }
        int budget = EJECTION_BUDGET_PER_ATTEMPT;
        for (Long fid : cand.flightIds()) {
            while (!solution.canAssign(fid, qty)) {
                if (budget-- <= 0) return false;
                if (!ejectOneBlocker(fid, victimId, solution)) return false;
            }
        }
        solution.assign(victimId, cand.flightIds());
        return !solution.getAssignment(victimId).isEmpty();
    }

    /**
     * Mueve UN lote del vuelo bloqueado hacia una ruta puntual alternativa propia que no
     * use ese vuelo. Se prueban primero los lotes más grandes (liberan más espacio por
     * movimiento). Retorna false si ningún ocupante tiene alternativa puntual factible.
     */
    private boolean ejectOneBlocker(Long blockedFlightId, Long victimId, AlnsSolution solution) {
        List<Long> occupants = solution.getBatchesOnFlight(blockedFlightId);
        occupants.sort(Comparator.comparingInt((Long id) -> {
            BaggageBatch b = solution.getBatchMap().get(id);
            return b != null ? b.getQuantity() : 0;
        }).reversed());

        for (Long xId : occupants) {
            if (xId.equals(victimId)) continue;
            BaggageBatch x = solution.getBatchMap().get(xId);
            if (x == null) continue;
            int xq = x.getQuantity();

            for (Candidate alt : candidateCache.getOrDefault(xId, Collections.emptyList())) {
                if (alt.staticCost() >= LATE_BASE_PENALTY) break; // solo alternativas puntuales
                if (alt.flightIds().contains(blockedFlightId)) continue; // debe LIBERAR el vuelo

                List<Long> originalRoute = new ArrayList<>(solution.getAssignment(xId));
                solution.unassign(xId);
                if (allLegsFit(alt.flightIds(), xq, solution)) {
                    solution.assign(xId, alt.flightIds());
                    return true;
                }
                solution.assign(xId, originalRoute); // esta alternativa no cabe: revertir
            }
        }
        return false;
    }

    @Override
    public String name() {
        return "RegretKInsertion";
    }
}
