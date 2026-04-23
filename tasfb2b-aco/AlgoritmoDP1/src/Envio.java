import java.time.LocalDateTime;

public class Envio {
    private int id;
    private String origen;
    private String destino;
    private LocalDateTime diaHoraIngreso;
    private int cantidadMaletas;
    
    public Envio(int id, String origen, String destino, 
                 LocalDateTime diaHoraIngreso, int cantidadMaletas) {
        this.id = id;
        this.origen = origen;
        this.destino = destino;
        this.diaHoraIngreso = diaHoraIngreso;
        this.cantidadMaletas = cantidadMaletas;
    }
    
    // Getters
    public int getId() { return id; }
    public String getOrigen() { return origen; }
    public String getDestino() { return destino; }
    public LocalDateTime getDiaHoraIngreso() { return diaHoraIngreso; }
    public int getCantidadMaletas() { return cantidadMaletas; }

    @Override
    public String toString() {
        return "Envio{" +
                "id=" + id +
                ", origen='" + origen + '\'' +
                ", destino='" + destino + '\'' +
                ", diaHoraIngreso=" + diaHoraIngreso +
                ", cantidadMaletas=" + cantidadMaletas +
                '}';
    }
}