import java.time.LocalDateTime;

public class Envio {
    private int id;
    private Aeropuerto origen;
    private Aeropuerto destino;
    private LocalDateTime diaHoraIngreso;
    private int cantidad_maletas;
    private boolean mismoContinente;
    
    public Envio(int id, Aeropuerto origen, Aeropuerto destino, 
                 LocalDateTime diaHoraIngreso, int cantidad_maletas) {
        this.id = id;
        this.origen = origen;
        this.destino = destino;
        this.diaHoraIngreso = diaHoraIngreso;
        this.cantidad_maletas = cantidad_maletas;
        this.mismoContinente = origen.getContinente().equals(destino.getContinente());
    }
    
    // Getters
    public int getId() { return id; }
    public Aeropuerto getOrigen() { return origen; }
    public Aeropuerto getDestino() { return destino; }
    public LocalDateTime getDiaHoraIngreso() { return diaHoraIngreso; }
    public int getCantidadMaletas() { return cantidad_maletas; }
    public int getCantidad_maletas() { return cantidad_maletas; }
    public boolean getEsMismoContinente() { return mismoContinente; }

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