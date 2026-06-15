package pe.pucp.tasfb2b.simulation;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Singleton in-memory store for raw shipment records uploaded by the user.
 * Files are accumulated via merge() so the user can upload them one at a time.
 * Organized by date for efficient range queries when a simulation starts.
 */
@Component
public class EnvioStore {

    private final TreeMap<LocalDate, List<RawEnvio>> byDate = new TreeMap<>();
    private int totalCount = 0;

    public synchronized void merge(List<RawEnvio> envios) {
        for (RawEnvio e : envios) {
            byDate.computeIfAbsent(e.getAvailableFrom().toLocalDate(), k -> new ArrayList<>()).add(e);
        }
        totalCount += envios.size();
    }

    public synchronized void clear() {
        byDate.clear();
        totalCount = 0;
    }

    /**
     * Returns all RawEnvio records within [start, end] inclusive.
     * Interior days skip the time check for performance since records are day-bucketed.
     */
    public synchronized List<RawEnvio> queryRange(LocalDateTime start, LocalDateTime end) {
        LocalDate startDate = start.toLocalDate();
        LocalDate endDate   = end.toLocalDate();

        NavigableMap<LocalDate, List<RawEnvio>> sub = byDate.subMap(startDate, true, endDate, true);
        List<RawEnvio> result = new ArrayList<>();

        for (Map.Entry<LocalDate, List<RawEnvio>> entry : sub.entrySet()) {
            LocalDate date = entry.getKey();
            for (RawEnvio envio : entry.getValue()) {
                if (date.isAfter(startDate) && date.isBefore(endDate)) {
                    result.add(envio);
                } else {
                    LocalDateTime t = envio.getAvailableFrom();
                    if (!t.isBefore(start) && !t.isAfter(end)) {
                        result.add(envio);
                    }
                }
            }
        }
        return result;
    }

    public synchronized boolean isLoaded()     { return !byDate.isEmpty(); }
    public synchronized int getTotalCount()    { return totalCount; }
    public synchronized LocalDate getMinDate() { return byDate.isEmpty() ? null : byDate.firstKey(); }
    public synchronized LocalDate getMaxDate() { return byDate.isEmpty() ? null : byDate.lastKey(); }
}
