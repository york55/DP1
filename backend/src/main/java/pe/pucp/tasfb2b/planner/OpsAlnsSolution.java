package pe.pucp.tasfb2b.planner;

import pe.pucp.tasfb2b.domain.OpsFlight;
import pe.pucp.tasfb2b.domain.OpsShipment;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Solución ALNS para el contexto de operaciones reales (OPS_*).
 * Análogo a AlnsSolution del módulo de simulación, sin dependencias cruzadas.
 */
public class OpsAlnsSolution {

    // shipmentId -> lista ordenada de flightIds (1 o 2 vuelos por ruta)
    private final Map<Long, List<Long>> assignments = new HashMap<>();
    // envíos aún sin asignar
    private final Set<Long> bank = new LinkedHashSet<>();
    // carga extra acumulada por vuelo en esta solución
    private final Map<Long, Integer> extraLoad = new HashMap<>();

    private final Map<Long, OpsFlight>   flightMap;
    private final Map<Long, OpsShipment> shipmentMap;

    public OpsAlnsSolution(List<OpsFlight> flights, List<OpsShipment> shipments) {
        this.flightMap   = flights.stream().collect(Collectors.toMap(OpsFlight::getId, f -> f));
        this.shipmentMap = shipments.stream().collect(Collectors.toMap(OpsShipment::getId, s -> s));
        shipments.forEach(s -> bank.add(s.getId()));
    }

    // ── Deep copy para el loop SA ─────────────────────────────────────────────

    public OpsAlnsSolution deepCopy() {
        OpsAlnsSolution copy = new OpsAlnsSolution(
                new ArrayList<>(flightMap.values()),
                new ArrayList<>(shipmentMap.values()));
        copy.bank.clear();
        copy.bank.addAll(this.bank);
        this.assignments.forEach((k, v) -> copy.assignments.put(k, new ArrayList<>(v)));
        copy.extraLoad.putAll(this.extraLoad);
        return copy;
    }

    // ── Operaciones básicas ───────────────────────────────────────────────────

    public void assign(Long shipmentId, List<Long> flightIds) {
        if (!bank.contains(shipmentId)) return;
        OpsShipment s = shipmentMap.get(shipmentId);
        if (s == null) return;
        for (Long fid : flightIds) {
            extraLoad.merge(fid, s.getBagCount(), Integer::sum);
        }
        assignments.put(shipmentId, new ArrayList<>(flightIds));
        bank.remove(shipmentId);
    }

    public void unassign(Long shipmentId) {
        List<Long> fids = assignments.remove(shipmentId);
        if (fids != null) {
            int qty = Optional.ofNullable(shipmentMap.get(shipmentId))
                              .map(OpsShipment::getBagCount).orElse(0);
            fids.forEach(fid -> extraLoad.merge(fid, -qty, Integer::sum));
            bank.add(shipmentId);
        }
    }

    public boolean canAssign(Long flightId, int bagCount) {
        OpsFlight f = flightMap.get(flightId);
        if (f == null) return false;
        int used = extraLoad.getOrDefault(flightId, 0);
        // capacity del vuelo ya tiene en cuenta la carga real persistida en assignedLoad
        return used + bagCount <= f.getCapacity();
    }

    // ── Métricas usadas por la función objetivo ───────────────────────────────

    public long waitingMinutes(Long shipmentId) {
        OpsShipment s = shipmentMap.get(shipmentId);
        if (s == null) return 0;
        List<Long> fids = assignments.get(shipmentId);
        if (fids == null || fids.isEmpty()) return 0;
        OpsFlight first = flightMap.get(fids.get(0));
        if (first == null) return 0;
        return Duration.between(s.getRegisteredAt(), first.getDepTimeUtc()).toMinutes();
    }

    /**
     * Minutos en que la llegada del último tramo asignado excede el deadline
     * del envío (SLA). Devuelve 0 si llega a tiempo, no tiene deadline o no
     * está asignado — se usa para penalizar incumplimientos de SLA en la
     * función objetivo.
     */
    public long lateMinutes(Long shipmentId) {
        OpsShipment s = shipmentMap.get(shipmentId);
        if (s == null || s.getDeadlineUtc() == null) return 0;
        List<Long> fids = assignments.get(shipmentId);
        if (fids == null || fids.isEmpty()) return 0;
        OpsFlight last = flightMap.get(fids.get(fids.size() - 1));
        if (last == null || last.getArrTimeUtc() == null) return 0;
        long lateness = Duration.between(s.getDeadlineUtc(), last.getArrTimeUtc()).toMinutes();
        return Math.max(0, lateness);
    }

    // ── Getters necesarios por el engine y los operadores ────────────────────

    public Set<Long>                     getBank()         { return Collections.unmodifiableSet(bank); }
    public int                           getBankSize()     { return bank.size(); }
    public Map<Long, List<Long>>         getAssignments()  { return Collections.unmodifiableMap(assignments); }
    public List<Long>                    getAssignedIds()  { return new ArrayList<>(assignments.keySet()); }
    public Map<Long, OpsFlight>          getFlightMap()    { return Collections.unmodifiableMap(flightMap); }
    public Map<Long, OpsShipment>        getShipmentMap()  { return Collections.unmodifiableMap(shipmentMap); }
    public Map<Long, Integer>            getExtraLoad()    { return Collections.unmodifiableMap(extraLoad); }
}