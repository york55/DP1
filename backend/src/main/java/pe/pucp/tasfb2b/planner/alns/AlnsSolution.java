package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

public class AlnsSolution {

    // batchId -> ordered list of flightIds
    private final Map<Long, List<Long>> assignments = new HashMap<>();
    // bank of unassigned batchIds
    private final Set<Long> bank = new LinkedHashSet<>();
    // flightId -> extra load from this solution (beyond initial currentLoad)
    private final Map<Long, Integer> extraLoad = new HashMap<>();
    // flight lookup by id
    private final Map<Long, Flight> flightMap;
    // batch lookup by id
    private final Map<Long, BaggageBatch> batchMap;

    public AlnsSolution(List<Flight> flights, List<BaggageBatch> batches) {
        this.flightMap = flights.stream().collect(Collectors.toMap(Flight::getId, f -> f));
        this.batchMap = batches.stream().collect(Collectors.toMap(BaggageBatch::getId, b -> b));
        for (BaggageBatch b : batches) {
            bank.add(b.getId());
        }
    }

    public AlnsSolution deepCopy() {
        AlnsSolution copy = new AlnsSolution(new ArrayList<>(flightMap.values()),
                new ArrayList<>(batchMap.values()));
        copy.bank.clear();
        copy.bank.addAll(this.bank);
        for (Map.Entry<Long, List<Long>> e : this.assignments.entrySet()) {
            copy.assignments.put(e.getKey(), new ArrayList<>(e.getValue()));
        }
        copy.extraLoad.putAll(this.extraLoad);
        return copy;
    }

    // Lightweight snapshot of mutable state only — shares flightMap/batchMap with source.
    // Use snapshot()/restore() inside the ALNS loop instead of deepCopy() to avoid
    // rebuilding the flight and batch lookup tables on every iteration.
    public record Snapshot(Map<Long, List<Long>> assignments, Set<Long> bank, Map<Long, Integer> extraLoad) {}

    public Snapshot snapshot() {
        Map<Long, List<Long>> assignCopy = new HashMap<>(assignments.size());
        assignments.forEach((k, v) -> assignCopy.put(k, new ArrayList<>(v)));
        return new Snapshot(assignCopy, new LinkedHashSet<>(bank), new HashMap<>(extraLoad));
    }

    public void restore(Snapshot snap) {
        assignments.clear();
        snap.assignments().forEach((k, v) -> assignments.put(k, new ArrayList<>(v)));
        bank.clear();
        bank.addAll(snap.bank());
        extraLoad.clear();
        extraLoad.putAll(snap.extraLoad());
    }

    public void assign(Long batchId, List<Long> flightIds) {
        if (!bank.contains(batchId)) return;
        BaggageBatch batch = batchMap.get(batchId);
        if (batch == null) return;

        for (Long fid : flightIds) {
            extraLoad.merge(fid, batch.getQuantity(), Integer::sum);
        }
        assignments.put(batchId, new ArrayList<>(flightIds));
        bank.remove(batchId);
    }

    public void unassign(Long batchId) {
        List<Long> fids = assignments.remove(batchId);
        if (fids != null) {
            BaggageBatch batch = batchMap.get(batchId);
            int qty = batch != null ? batch.getQuantity() : 0;
            for (Long fid : fids) {
                extraLoad.merge(fid, -qty, Integer::sum);
            }
            bank.add(batchId);
        }
    }

    public boolean canAssign(Long flightId, int quantity) {
        Flight f = flightMap.get(flightId);
        if (f == null) return false;
        int used = f.getCurrentLoad() + extraLoad.getOrDefault(flightId, 0);
        return used + quantity <= f.getBaggageCapacity();
    }

    public List<Long> getAssignment(Long batchId) {
        return assignments.getOrDefault(batchId, Collections.emptyList());
    }

    public List<Long> getAssignedBatchIds() {
        return new ArrayList<>(assignments.keySet());
    }

    public Set<Long> getBank() {
        return Collections.unmodifiableSet(bank);
    }

    public int getBankSize() {
        return bank.size();
    }

    public Set<Long> getFlightIds() {
        Set<Long> ids = new HashSet<>();
        for (List<Long> fids : assignments.values()) {
            ids.addAll(fids);
        }
        return ids;
    }

    public List<Long> getBatchesOnFlight(Long flightId) {
        return assignments.entrySet().stream()
                .filter(e -> e.getValue().contains(flightId))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    public long getFlightDeparture(Long flightId) {
        Flight f = flightMap.get(flightId);
        if (f == null) return Long.MAX_VALUE;
        return java.sql.Timestamp.valueOf(f.getDepartureTime()).getTime();
    }

    public long getWaitingMinutes(Long batchId) {
        BaggageBatch batch = batchMap.get(batchId);
        if (batch == null) return 0;
        List<Long> fids = assignments.get(batchId);
        if (fids == null || fids.isEmpty()) return 0;
        Flight firstFlight = flightMap.get(fids.get(0));
        if (firstFlight == null) return 0;
        return Duration.between(batch.getAvailableFrom(), firstFlight.getDepartureTime()).toMinutes();
    }

    /**
     * Minutos TOTALES que el lote pasa en tierra: espera en el origen antes de embarcar
     * MÁS la suma de los gaps de conexión en cada hub intermedio. Antes solo se medía la
     * espera en el origen (getWaitingMinutes), así que una conexión con 20 horas de layover
     * — 20 horas de maletas ocupando el almacén del hub, que es justo lo que provoca el
     * colapso por ocupación — le costaba CERO al planificador.
     */
    public long getGroundMinutes(Long batchId) {
        BaggageBatch batch = batchMap.get(batchId);
        if (batch == null) return 0;
        List<Long> fids = assignments.get(batchId);
        if (fids == null || fids.isEmpty()) return 0;

        Flight first = flightMap.get(fids.get(0));
        if (first == null) return 0;
        long total = Math.max(0, Duration.between(batch.getAvailableFrom(),
                first.getDepartureTime()).toMinutes());

        for (int i = 1; i < fids.size(); i++) {
            Flight prev = flightMap.get(fids.get(i - 1));
            Flight next = flightMap.get(fids.get(i));
            if (prev == null || next == null) continue;
            total += Math.max(0, Duration.between(prev.getArrivalTime(),
                    next.getDepartureTime()).toMinutes());
        }
        return total;
    }

    /** Hora de llegada estimada al destino final (último tramo asignado), o null si no tiene ruta. */
    public LocalDateTime getEstimatedArrival(Long batchId) {
        List<Long> fids = assignments.get(batchId);
        if (fids == null || fids.isEmpty()) return null;
        Flight lastFlight = flightMap.get(fids.get(fids.size() - 1));
        return lastFlight != null ? lastFlight.getArrivalTime() : null;
    }

    /**
     * Minutos por los que la llegada estimada excede el deadline SLA del lote
     * (1 día mismo continente / 2 días distinto continente). Retorna 0 si llega a tiempo
     * o si no tiene ruta asignada — este es el "sensor" que faltaba en la búsqueda del ALNS.
     */
    public long getLatenessMinutes(Long batchId) {
        BaggageBatch batch = batchMap.get(batchId);
        if (batch == null) return 0;
        LocalDateTime arrival = getEstimatedArrival(batchId);
        if (arrival == null) return 0;
        LocalDateTime deadline = DeadlineUtil.computeDeadline(batch);
        return Math.max(0, Duration.between(deadline, arrival).toMinutes());
    }

    public Map<Long, Flight> getFlightMap() {
        return Collections.unmodifiableMap(flightMap);
    }

    public Map<Long, BaggageBatch> getBatchMap() {
        return Collections.unmodifiableMap(batchMap);
    }

    public Map<Long, List<Long>> getAssignments() {
        return Collections.unmodifiableMap(assignments);
    }

    public Map<Long, Integer> getExtraLoad() {
        return Collections.unmodifiableMap(extraLoad);
    }
}
