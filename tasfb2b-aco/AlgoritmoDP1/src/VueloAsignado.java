import java.time.LocalDate;
import java.time.LocalTime;

public class VueloAsignado {
    private String origen;
    private String destino;
    private LocalTime horaSalida;
    private LocalTime horaLlegada;

    private LocalDate fecha;
    private int maletasAsignadas;
    private int capacidadMaxima;

    // Constructor basado en Vuelo
    public VueloAsignado(Vuelo v, LocalDate fecha, int maletas) {
        this.origen = v.getOrigen();
        this.destino = v.getDestino();
        this.horaSalida = v.getHoraSalida();
        this.horaLlegada = v.getHoraLlegada();
        this.capacidadMaxima = v.getCapacidadMax();
        this.fecha = fecha;
        this.maletasAsignadas = maletas;
    }

    // Constructor de copia (EL QUE TE FALTA)
    public VueloAsignado(VueloAsignado otro) {
        this.origen = otro.origen;
        this.destino = otro.destino;
        this.horaSalida = otro.horaSalida;
        this.horaLlegada = otro.horaLlegada;
        this.fecha = otro.fecha;
        this.maletasAsignadas = otro.maletasAsignadas;
        this.capacidadMaxima = otro.capacidadMaxima;
    }

    // getters
    public String getOrigen() { return origen; }
    public String getDestino() { return destino; }
    public LocalDate getFecha() { return fecha; }
    public LocalTime getHoraSalida() { return horaSalida; }
    public LocalTime getHoraLlegada() { return horaLlegada; }
    public int getMaletasAsignadas() { return maletasAsignadas; }
    public int getCapacidadMax() {
        return this.capacidadMaxima;
    }
}