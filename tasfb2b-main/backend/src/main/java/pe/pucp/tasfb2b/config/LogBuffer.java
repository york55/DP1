package pe.pucp.tasfb2b.config;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
public class LogBuffer {

    private static final int MAX = 500;
    private static volatile LogBuffer INSTANCE;

    private final Deque<LogEntry> backend = new ConcurrentLinkedDeque<>();
    private final Deque<LogEntry> frontend = new ConcurrentLinkedDeque<>();

    @PostConstruct
    void init() { INSTANCE = this; }

    public static LogBuffer getInstance() { return INSTANCE; }

    public void addBackend(String level, String source, String message) {
        offer(backend, new LogEntry(Instant.now().toString(), level, abbrev(source), message));
    }

    public void addFrontend(String level, String source, String message) {
        offer(frontend, new LogEntry(Instant.now().toString(), level, source, message));
    }

    private void offer(Deque<LogEntry> d, LogEntry e) {
        d.addLast(e);
        while (d.size() > MAX) d.pollFirst();
    }

    private String abbrev(String loggerName) {
        if (loggerName == null) return "";
        int dot = loggerName.lastIndexOf('.');
        return dot >= 0 ? loggerName.substring(dot + 1) : loggerName;
    }

    public List<LogEntry> getBackend(int limit) { return tail(backend, limit); }
    public List<LogEntry> getFrontend(int limit) { return tail(frontend, limit); }

    private List<LogEntry> tail(Deque<LogEntry> d, int limit) {
        Object[] arr = d.toArray();
        int from = Math.max(0, arr.length - limit);
        List<LogEntry> out = new ArrayList<>(arr.length - from);
        for (int i = from; i < arr.length; i++) out.add((LogEntry) arr[i]);
        return out;
    }

    public record LogEntry(String timestamp, String level, String source, String message) {}
}
