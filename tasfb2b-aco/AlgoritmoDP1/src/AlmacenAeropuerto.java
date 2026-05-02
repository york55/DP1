import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class AlmacenAeropuerto {
    public static class EventoMaletas {
        int idEnvio;
        String origen;
        LocalTime momento;
        int deltaMaleta;

        EventoMaletas(Envio envio,LocalTime momento,int deltaMaleta){
            this.idEnvio = envio.getId();
            this.origen = envio.getOrigen().getCodigo();
            this.momento = momento;
            this.deltaMaleta = deltaMaleta;
        }
    }
    private final Aeropuerto aeropuerto;
    private final Map<LocalDate,List<EventoMaletas>> eventosPorFecha;
    
    public AlmacenAeropuerto(Aeropuerto aeropuerto){
        this.aeropuerto = aeropuerto;
        this.eventosPorFecha = new HashMap<>();
    }

    public int getMaletasEnMomento(LocalDateTime fechaHora) {
        int total = 0;
        LocalTime hora = fechaHora.toLocalTime();

        List<EventoMaletas> eventos = eventosPorFecha.getOrDefault(
            fechaHora.toLocalDate(), Collections.emptyList()
        );

        for (EventoMaletas e : eventos) {
            if (!e.momento.isAfter(hora)) {
                total += e.deltaMaleta;
            }
        }

        return Math.max(total, 0);
    }

    public boolean hayEspacio(int cantidadMaletas, LocalDateTime horaLlegada) {
        int actuales = getMaletasEnMomento(horaLlegada);
        return (actuales + cantidadMaletas) <= aeropuerto.getCapacidadMaxima();
    }

    public void registrarLlegada(Envio envio, LocalDateTime horaLlegada) {
        agregarEvento(envio,horaLlegada, +envio.getCantidad_maletas());
    }

    public void registrarSalida(Envio envio, LocalDateTime horaSalida) {
        agregarEvento(envio,horaSalida, -envio.getCantidad_maletas());
    }

    public void revertirLlegada(int cantidadMaletas, LocalDateTime horaLlegada) {
        List<EventoMaletas> eventos = eventosPorFecha.get(horaLlegada.toLocalDate());
        if (eventos != null && !eventos.isEmpty()) {
            eventos.remove(eventos.size() - 1);
        }
    }

    public void revertirSalida(int cantidadMaletas, LocalDateTime horaSalida) {
        List<EventoMaletas> eventos = eventosPorFecha.get(horaSalida.toLocalDate());
        if (eventos != null && !eventos.isEmpty()) {
            eventos.remove(eventos.size() - 1);
        }
    }

    private void agregarEvento(Envio envio,LocalDateTime momento, int delta) {
        eventosPorFecha
            .computeIfAbsent(momento.toLocalDate(), k -> new ArrayList<>())
            .add(new EventoMaletas(envio,momento.toLocalTime(), delta));
    }

    public Aeropuerto getAeropuerto() {
        return aeropuerto;
    }

    public void imprimir(LocalDate fecha) {
        System.out.println("=== Almacén: " + aeropuerto.getCodigo() + 
                        " | Capacidad máx: " + aeropuerto.getCapacidadMaxima() + 
                        " | Fecha: " + fecha + " ===");
        List<EventoMaletas> eventos = eventosPorFecha.getOrDefault(fecha, new ArrayList<>());
        if (eventos.isEmpty()) {
            System.out.println("  (sin movimientos este día)");
            return;
        }
        eventos.stream()
            .sorted(Comparator.comparing(e -> e.momento))
            .forEach(e -> {
                String tipo = e.deltaMaleta > 0 ? "LLEGADA " : "SALIDA  ";
                System.out.printf("Envio %d de %s  %s | %s | %+d maletas %n",
                    e.idEnvio,
                    e.origen,
                    tipo,
                    e.momento,
                    e.deltaMaleta
                );
            });
        System.out.println("  ------------------------------------------");
        System.out.println();
    }
}
