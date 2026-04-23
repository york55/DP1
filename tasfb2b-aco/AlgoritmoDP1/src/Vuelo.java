import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

public class Vuelo {
    private int idx;
    private String id;
    private String origen;
    private String destino;
    private Aeropuerto aero_origen;
    private Aeropuerto aero_destino;
    private LocalTime horaSalida;
    private LocalTime horaLlegada;
    private int capacidadMax;
    private int n_maletas;

    //capacidad es por dia
    Map<LocalDate,Integer> maletasFechas;
    
    public Vuelo(Vuelo v){
        this.id = v.id;
        this.origen = v.origen;
        this.destino = v.destino;
        this.horaSalida = v.horaSalida;
        this.horaLlegada = v.horaLlegada;
        this.capacidadMax = v.capacidadMax;

        this.maletasFechas = new HashMap<>();
    }

    public Vuelo(int idx,Aeropuerto aero_origen,Aeropuerto aero_destino,String id, String origen, String destino, 
                 LocalTime horaSalida, LocalTime horaLlegada, int capacidadMax) {
        this.idx = idx;
        this.id = id;
        this.origen = origen;
        this.destino = destino;
        this.horaSalida = horaSalida;
        this.horaLlegada = horaLlegada;
        this.capacidadMax = capacidadMax;
        this.n_maletas = 0;
        this.aero_destino = aero_destino;
        this.aero_origen = aero_origen;
        this.maletasFechas = new HashMap<>();
    }
    
    public int getIdx() { return idx; }
    public String getId() { return id; }
    public String getOrigen() { return origen; }
    public String getDestino() { return destino; }
    public LocalTime getHoraSalida() { return horaSalida; }
    public LocalTime getHoraLlegada() { return horaLlegada; }
    public int getCapacidadMax() { return capacidadMax; }
    public Aeropuerto getAeroOrigen() { return aero_origen; }
    public Aeropuerto getAeroDestino() { return aero_destino; }

    public int getCapacidadActual(){
        return capacidadMax - n_maletas;
    }
    
    public double getDuracionHoras() {
        int minutosSalida = horaSalida.getHour() * 60 + horaSalida.getMinute();
        int minutosLlegada = horaLlegada.getHour() * 60 + horaLlegada.getMinute();
        int diferencia = minutosLlegada - minutosSalida;
        if (diferencia < 0) diferencia += 24 * 60;
        return diferencia / 60.0;
    }

    public int restarCapacidad(int envio_maletas){
        n_maletas += envio_maletas;
        return capacidadMax - n_maletas;
    }

    public int restarCapacidadFecha(LocalDate fecha,int maletas) {
        return maletasFechas.compute(fecha, (k, v) -> 
            (v == null ? this.capacidadMax : v) + maletas
        );
    }

    public int getCapacidadActualFecha(LocalDate fecha){
        int maletas = maletasFechas.getOrDefault(fecha, 0);
        return capacidadMax - maletas;
    }

    @Override
    public String toString() {
        return String.format("%s->%s (%02d:%02d -> %02d:%02d, cap=%d)", 
                origen, destino, 
                horaSalida.getHour(), horaSalida.getMinute(),
                horaLlegada.getHour(), horaLlegada.getMinute(),
                capacidadMax);
    }

    //PRUEBAS
    public void usarCapacidadFecha(LocalDate fecha, int maletas) {
        int usadas = maletasFechas.getOrDefault(fecha, 0);
        usadas += maletas;
        maletasFechas.put(fecha, usadas);
    }

    public void liberarCapacidadFecha(LocalDate fecha, int maletas) {
        int usadas = maletasFechas.getOrDefault(fecha, 0);
        usadas -= maletas;

        if (usadas <= 0) {
            maletasFechas.remove(fecha);
        } else {
            maletasFechas.put(fecha, usadas);
        }
    }

    public VueloAsignado getVueloAsignado(LocalDate fecha){
        return new VueloAsignado(this,fecha,maletasFechas.get(fecha));
    }

}