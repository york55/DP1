import java.util.ArrayList;
import java.util.List;

public class Ruta {
    private Envio envio_asignado;
    private List<VueloAsignado> vuelos;
    private double tiempoTotal;

    public Ruta() {
        this.vuelos = new ArrayList<>();
        this.tiempoTotal = 0;
        this.envio_asignado = null;
    }

    // Copy constructor correcto
    public Ruta(Ruta otra) {
        this.envio_asignado = otra.envio_asignado;
        this.tiempoTotal = otra.tiempoTotal;

        this.vuelos = new ArrayList<>();
        for (VueloAsignado v : otra.vuelos) {
            // copia ligera (no necesitas deep compleja)
            this.vuelos.add(new VueloAsignado(v));
        }
    }

    public void setEnvioAsignado(Envio envio){
        this.envio_asignado = envio;
    }

    public Envio getEnvioAsignado(){
        return this.envio_asignado;
    }

    public void agregarVuelo(VueloAsignado vuelo) {
        vuelos.add(vuelo);
    }

    public List<VueloAsignado> getVuelos() {
        return vuelos;
    }

    public void setTiempoTotal(double tiempoTotal) {
        this.tiempoTotal = tiempoTotal;
    }

    public double getTiempoTotal() {
        return tiempoTotal;
    }

    public boolean isEmpty() {
        return vuelos.isEmpty();
    }

    public VueloAsignado getUltimoVuelo() {
        return vuelos.isEmpty() ? null : vuelos.get(vuelos.size() - 1);
    }

    public String getDestinoFinal() {
        if (vuelos.isEmpty()) return null;
        return vuelos.get(vuelos.size() - 1).getDestino();
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();

        if (envio_asignado != null) {
            sb.append("Envio: ").append(envio_asignado).append("\n");
        } else {
            sb.append("Envio: null\n");
        }

        if (vuelos.isEmpty()) {
            sb.append("Ruta vacia");
            return sb.toString();
        }

        sb.append("\nDetalle vuelos:\n");
        for (VueloAsignado v : vuelos) {
            sb.append("  ")
            .append(v.getOrigen()).append("->").append(v.getDestino())
            .append(" | ").append(v.getFecha())
            .append(" | ").append(v.getHoraSalida())
            .append("-").append(v.getHoraLlegada())
            .append(" | maletas: ").append(v.getMaletasAsignadas())
            .append("\n");
        }

        sb.append(String.format(" (tiempo: %.2f horas)", tiempoTotal));
        return sb.toString();
    }
}