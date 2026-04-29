package src;
import java.time.LocalDateTime;

public class Envio {
    private int id;
    private Aeropuerto origen;
    private Aeropuerto destino;
    private LocalDateTime diaHoraIngreso;
    private int cantidad_maletas;
    private boolean mismoContinente;

    public Envio() {
    }

    public Envio(int id, Aeropuerto origen, Aeropuerto destino, LocalDateTime diaHoraIngreso, int cantidad_maletas) {
        this.id = id;
        this.origen = origen;
        this.destino = destino;
        this.diaHoraIngreso = diaHoraIngreso;
        this.cantidad_maletas = cantidad_maletas;
        this.mismoContinente = (origen.getCodigo().equals(destino.getCodigo())) ? true : false;
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
    public LocalDateTime getDiaHoraIngreso() {
        return diaHoraIngreso;
    }
    public void setDiaHoraIngreso(LocalDateTime diaHoraIngreso) {
        this.diaHoraIngreso = diaHoraIngreso;
    }
    public int getCantidad_maletas() {
        return cantidad_maletas;
    }
    public void setCantidad_maletas(int cantidad_maletas) {
        this.cantidad_maletas = cantidad_maletas;
    }

    public boolean getEsMismoContinente(){
        return this.mismoContinente;
    }

    /*
    @Override
    public String toString() {
        return "Envio{" +
                "id=" + id +
                ", origen=" + origen +
                ", destino=" + destino +
                ", diaHoraIngreso=" + diaHoraIngreso +
                ", cantidad_maletas=" + cantidad_maletas +
                '}';
    }
    */

    @Override
    public String toString() {
        return "===== DETALLE ENVÍO =====\n" +
            "ID: " + id + "\n" +
            "Origen: " + origen + "\n" +
            "Destino: " + destino + "\n" +
            "Fecha ingreso: " + diaHoraIngreso + "\n" +
            "Cantidad maletas: " + cantidad_maletas + "\n" +
            "=========================";
    }
}