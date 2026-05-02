import java.util.ArrayList;
import java.util.List;

public class RutaEnvio {
    private Envio envio;
    private List<VueloFecha> vuelos;
    private double tiempoTotal;

    public RutaEnvio() {
        this.vuelos = new ArrayList<>();
        this.tiempoTotal = 0;
        this.envio = null;
    }

    public RutaEnvio(Envio envio, List<VueloFecha> vuelos, double tiempoTotal) {
        this.envio = envio;
        this.vuelos = vuelos;
        this.tiempoTotal = tiempoTotal;
    }

    public RutaEnvio(RutaEnvio otra) {
        this.envio = otra.envio; // referencia (puedes clonar si quieres inmutabilidad)
        this.vuelos = new ArrayList<>(otra.vuelos); // copia de lista
        this.tiempoTotal = otra.tiempoTotal;
    }

    public void agregarVuelo(VueloFecha vuelo) {
        this.vuelos.add(vuelo);
    }
    public Envio getEnvio() {
        return envio;
    }
    public void setEnvio(Envio envio) {
        this.envio = envio;
    }
    public List<VueloFecha> getVuelos() {
        return vuelos;
    }
    public void setVuelos(List<VueloFecha> vuelos) {
        this.vuelos = vuelos;
    }
    public double getTiempoTotal() {
        return tiempoTotal;
    }
    public void setTiempoTotal(double tiempoTotal) {
        this.tiempoTotal = tiempoTotal;
    }
    @Override
    public String toString() {
        return "RutaEnvio{" +
                "envio=" + envio +
                ", vuelos=" + vuelos +
                ", tiempoTotal=" + tiempoTotal +
                '}';
    }
}
