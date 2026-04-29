package src;

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
        LocalTime momento;
        int deltaMaleta;

        EventoMaletas(LocalTime momento,int deltaMaleta){
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

    /**
     * Registra la llegada de maletas (entran al almacén).
     */
    public void registrarLlegada(int cantidadMaletas, LocalDateTime horaLlegada) {
        agregarEvento(horaLlegada, +cantidadMaletas);
    }

    /**
     * Registra la salida de maletas (salen del almacén).
     */
    public void registrarSalida(int cantidadMaletas, LocalDateTime horaSalida) {
        agregarEvento(horaSalida, -cantidadMaletas);
    }

    /**
     * Revierte una llegada (al deshacer una ruta).
     */
    public void revertirLlegada(int cantidadMaletas, LocalDateTime horaLlegada) {
        //agregarEvento(horaLlegada, -cantidadMaletas);
        //No agregar evento
        eventosPorFecha
            .get(horaLlegada.toLocalDate())
            .removeLast(); //Esta ultimo lo puesto
    }

    /**
     * Revierte una salida (al deshacer una ruta).
     */
    public void revertirSalida(int cantidadMaletas, LocalDateTime horaSalida) {
        //agregarEvento(horaSalida, +cantidadMaletas);
        eventosPorFecha
            .get(horaSalida.toLocalDate())
            .removeLast(); //Esta ultimo lo puesto
    }

    private void agregarEvento(LocalDateTime momento, int delta) {
        eventosPorFecha
            .computeIfAbsent(momento.toLocalDate(), k -> new ArrayList<>())
            .add(new EventoMaletas(momento.toLocalTime(), delta));
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
        // Ordenar eventos por momento para mostrarlos cronológicamente
        eventos.stream()
            .sorted(Comparator.comparing(e -> e.momento))
            .forEach(e -> {
                String tipo = e.deltaMaleta > 0 ? "LLEGADA " : "SALIDA  ";
                System.out.printf("  %s | %s | %+d maletas %n",
                    tipo,
                    e.momento,
                    e.deltaMaleta
                );
            });
        // Resumen al final
        System.out.println("  ------------------------------------------");
        System.out.println();
    }
}
