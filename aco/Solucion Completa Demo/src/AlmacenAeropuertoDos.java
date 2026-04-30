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

import src.AlmacenAeropuerto.EventoMaletas;

public class AlmacenAeropuertoDos {
    public class EventoMaletasCliente {
        Envio envio;
        LocalTime momento;

        EventoMaletasCliente(Envio envio, LocalTime momento) {
            this.envio = envio;
            this.momento = momento;
        }
        public Envio getEnvio() { return this.envio; } 
    }
    public class EventoMaletasVuelo {
        VueloFecha vueloFecha; //referencia al objeto que tiene las maletas que entran o salen
        boolean es_vuelo_salida;
        EventoMaletasVuelo(VueloFecha vuelo) {
            this.vueloFecha = vuelo;
            String origen_vuelo = vuelo.getVueloBase().getOrigen().getCodigo();
            if(origen_vuelo.equals(aeropuerto.getCodigo())) this.es_vuelo_salida = true;
            else this.es_vuelo_salida = false;
        }
        public VueloFecha getVueloFecha() { return this.vueloFecha; }
    }
    private final Aeropuerto aeropuerto;
    private final Map<LocalDate, List<EventoMaletasCliente>> eventosClientes;
    private final Map<LocalDate, List<EventoMaletasVuelo>> eventosVuelos;

    public AlmacenAeropuertoDos(Aeropuerto aeropuerto){
        this.aeropuerto = aeropuerto;
        this.eventosClientes = new HashMap<>();
        this.eventosVuelos = new HashMap<>();
    }

    public int getMaletasEnMomentoDOS(LocalDateTime fechaHora){
        int total = 0;
        LocalDate fecha = fechaHora.toLocalDate();
        LocalTime hora = fechaHora.toLocalTime();
        //Envios que dejo cliente en aeropuerto
        List<EventoMaletasCliente> eventosC = eventosClientes.getOrDefault(
            fecha, Collections.emptyList()
        );
        for (EventoMaletasCliente e : eventosC) {
            if (!e.momento.isAfter(hora)) {
                total += e.getEnvio().getCantidad_maletas();
            }
        }

        // Vuelos que salen y llegan
        List<EventoMaletasVuelo> eventosV = eventosVuelos.getOrDefault(
            fecha, Collections.emptyList()
        );

        for (EventoMaletasVuelo evento : eventosV) {
            if(evento.es_vuelo_salida){
                LocalTime horaSalida = evento.getVueloFecha().getVueloBase().getHoraSalida();
                if(horaSalida.isBefore(hora)){
                    total -= ;
                }
            }else{
                LocalTime horaLlegada = evento.getVueloFecha().getVueloBase().getHoraLlegada();
                if(horaLlegada.isBefore(hora)){
                    total += ;
                }
            }
        }

        return Math.max(total, 0);
    }







































    /*public int getMaletasEnMomento(LocalDateTime fechaHora) {
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

    
    //  Registra la llegada de maletas (entran al almacén).
    
    public void registrarLlegada(Envio envio, LocalDateTime horaLlegada) {
        agregarEvento(envio,horaLlegada, +envio.getCantidad_maletas());
    }

    
    //  Registra la salida de maletas (salen del almacén).
     
    public void registrarSalida(Envio envio, LocalDateTime horaSalida) {
        agregarEvento(envio,horaSalida, -envio.getCantidad_maletas());
    }

    
     // Revierte una llegada (al deshacer una ruta).
    
    public void revertirLlegada(int cantidadMaletas, LocalDateTime horaLlegada) {
        //agregarEvento(horaLlegada, -cantidadMaletas);
        //No agregar evento
        eventosPorFecha
            .get(horaLlegada.toLocalDate())
            .removeLast(); //Esta ultimo lo puesto
    }

    
    // Revierte una salida (al deshacer una ruta).
    
    public void revertirSalida(int cantidadMaletas, LocalDateTime horaSalida) {
        //agregarEvento(horaSalida, +cantidadMaletas);
        eventosPorFecha
            .get(horaSalida.toLocalDate())
            .removeLast(); //Esta ultimo lo puesto
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
        // Ordenar eventos por momento para mostrarlos cronológicamente
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
        // Resumen al final
        System.out.println("  ------------------------------------------");
        System.out.println();
    }*/
}
