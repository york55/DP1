package src;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

public class VueloDiario {
    private int id;
    private Aeropuerto origen;
    private Aeropuerto destino;
    private LocalTime horaSalida;
    private LocalTime horaLlegada;
    private int capacidadMaxima;
    private Map<LocalDate, VueloFecha> vuelosFechas;
    private double duracion;
    private boolean esTrasnoche;

    public VueloDiario() {
        this.vuelosFechas = new HashMap<>();
    }

    public VueloDiario(int id, Aeropuerto origen, Aeropuerto destino,
                        LocalTime horaSalida, LocalTime horaLlegada,
                        int capacidadMaxima) {
        this.id = id;
        this.origen = origen;
        this.destino = destino;
        this.horaSalida = horaSalida;
        this.horaLlegada = horaLlegada;
        this.capacidadMaxima = capacidadMaxima;
        this.esTrasnoche = horaLlegada.isBefore(horaSalida);
        this.vuelosFechas = new HashMap<>();
        //Calcular duracion de los vuelos
        LocalDate fechaBase = LocalDate.of(2000, 1, 1);
        LocalDateTime salida = LocalDateTime.of(fechaBase, horaSalida);
        LocalDateTime llegada;
        if (esTrasnoche) {
            llegada = LocalDateTime.of(fechaBase.plusDays(1), horaLlegada);
        } else {
            llegada = LocalDateTime.of(fechaBase, horaLlegada);
        }
        this.duracion = Duration.between(salida, llegada).toMinutes() / 60.0;
    }

    public LocalDateTime getFechaHoraLlegada(LocalDate fechaSalida) {
        if (esTrasnoche) {
            return LocalDateTime.of(fechaSalida.plusDays(1), horaLlegada);
        } else {
            return LocalDateTime.of(fechaSalida, horaLlegada);
        }
    }

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public Aeropuerto getOrigen() {
        return origen;
    }
    public void setOrigen(Aeropuerto origen) {
        this.origen = origen;
    }
    public Aeropuerto getDestino() {
        return destino;
    }
    public void setDestino(Aeropuerto destino) {
        this.destino = destino;
    }
    public LocalTime getHoraSalida() {
        return horaSalida;
    }
    public void setHoraSalida(LocalTime horaSalida) {
        this.horaSalida = horaSalida;
    }
    public LocalTime getHoraLlegada() {
        return horaLlegada;
    }
    public void setHoraLlegada(LocalTime horaLlegada) {
        this.horaLlegada = horaLlegada;
    }
    public int getCapacidadMaxima() {
        return capacidadMaxima;
    }
    public void setCapacidadMaxima(int capacidadMaxima) {
        this.capacidadMaxima = capacidadMaxima;
    }

    public double getDuracionHoras() {
        return this.duracion;
    }

    public VueloFecha getVueloFecha(LocalDate fechaActual){
        return vuelosFechas.computeIfAbsent(fechaActual, fecha -> 
            new VueloFecha(this, fecha, this.capacidadMaxima)
        );
    }
}