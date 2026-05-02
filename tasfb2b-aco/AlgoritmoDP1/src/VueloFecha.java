import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class VueloFecha {
    private VueloDiario vueloBase;
    private LocalDate fecha;
    private int totalMaletas;
    private int capacidadMaxima;

    private LocalDateTime fechaHoraSalida;
    private LocalDateTime fechaHoraLlegada;

    private List<Envio> enviosProgramados;

    public VueloFecha(VueloDiario vueloBase, LocalDate fecha, int capacidadMaxima) {
        this.vueloBase = vueloBase;
        this.fecha = fecha;
        this.capacidadMaxima = capacidadMaxima;
        this.totalMaletas = 0;
        this.enviosProgramados = new ArrayList<>();
        //Setear hora y salida llegada exacta 
        LocalTime horaSalida = vueloBase.getHoraSalida();
        LocalTime horaLlegada = vueloBase.getHoraLlegada();
        this.fechaHoraSalida = LocalDateTime.of(fecha, horaSalida);
        if (horaLlegada.isBefore(horaSalida)) {
            this.fechaHoraLlegada = LocalDateTime.of(fecha.plusDays(1), horaLlegada);
        } else {
            this.fechaHoraLlegada = LocalDateTime.of(fecha, horaLlegada);
        }
    }

    public boolean agregarEnvio(Envio envio) {
        int nuevasMaletas = totalMaletas + envio.getCantidad_maletas();
        if (nuevasMaletas > capacidadMaxima) {
            return false; // no entra
        }
        enviosProgramados.add(envio);
        totalMaletas = nuevasMaletas;
        return true;
    }
    
    public void quitarEnvio(Envio envio) {
        this.enviosProgramados.remove(envio);
        totalMaletas -= envio.getCantidad_maletas();
    }

    public VueloDiario getVueloBase() {
        return vueloBase;
    }
    public void setVueloBase(VueloDiario vueloBase) {
        this.vueloBase = vueloBase;
    }
    public LocalDate getFecha() {
        return fecha;
    }
    public void setFecha(LocalDate fecha) {
        this.fecha = fecha;
    }
    public int getTotalMaletas() {
        return totalMaletas;
    }
    public void setTotalMaletas(int totalMaletas) {
        this.totalMaletas = totalMaletas;
    }
    public int getCapacidadMaxima() {
        return capacidadMaxima;
    }
    public void setCapacidadMaxima(int capacidadMaxima) {
        this.capacidadMaxima = capacidadMaxima;
    }
    public List<Envio> getEnviosProgramados() {
        return enviosProgramados;
    }
    public void setEnviosProgramados(List<Envio> enviosProgramados) {
        this.enviosProgramados = enviosProgramados;
    }
    public LocalDateTime getFechaHoraSalida(){ return this.fechaHoraSalida; }
    public LocalDateTime getFechaHoraLlegada() { return this.fechaHoraLlegada; }
}
