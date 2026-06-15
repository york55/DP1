package pe.pucp.tasfb2b.planner.alns;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;

import java.time.Duration;
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
