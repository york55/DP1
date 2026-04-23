import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SolucionLoteACO {
    // Estado de cada envío: ID del envío -> Ruta (puede ser null si falló)
    private final Map<Integer, Ruta> asignaciones;
    
    // Estadísticas del lote
    private final int totalEnvios;
    private final int enviosExitosos;
    private final int enviosFallidos;
    private final double costoTotal;
    private final long tiempoEjecucionMs;
    
    // Lista de envíos que no pudieron ser asignados para facilitar el reintento
    private final List<Integer> idsFallidos;

    public SolucionLoteACO(Map<Integer, Ruta> asignaciones, double costoTotal, long tiempoMs) {
        this.asignaciones = asignaciones;
        this.costoTotal = costoTotal;
        this.tiempoEjecucionMs = tiempoMs;
        this.totalEnvios = asignaciones.size();
        
        this.idsFallidos = new ArrayList<>();
        int exitos = 0;
        for (Map.Entry<Integer, Ruta> entry : asignaciones.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                exitos++;
            } else {
                idsFallidos.add(entry.getKey());
            }
        }
        this.enviosExitosos = exitos;
        this.enviosFallidos = totalEnvios - exitos;
    }

    // --- Getters ---
    public Map<Integer, Ruta> getAsignaciones() { return asignaciones; }
    public boolean todoExitoso() { return enviosFallidos == 0; }
    public int getEnviosFallidos() { return enviosFallidos; }
    public List<Integer> getIdsFallidos() { return idsFallidos; }
    public double getCostoTotal() { return costoTotal; }

    @Override
    public String toString() {
        return String.format("Resumen Lote: Total=%d, Éxito=%d, Fallo=%d, Costo=%.2f, Tiempo=%dms",
                totalEnvios, enviosExitosos, enviosFallidos, costoTotal, tiempoEjecucionMs);
    }

    public void imprimirDetalleLote() {
        System.out.println("===== DETALLE DEL LOTE =====");

        for (Map.Entry<Integer, Ruta> entry : asignaciones.entrySet()) {
            int idEnvio = entry.getKey();
            Ruta ruta = entry.getValue();

            System.out.println("Envio ID: " + idEnvio);

            if (ruta == null || ruta.isEmpty()) {
                System.out.println(" Sin ruta");
                System.out.println("----------------------------------");
                continue;
            }

            Envio envio = ruta.getEnvioAsignado();

            if (envio != null) {
                System.out.println("  Origen: " + envio.getOrigen());
                System.out.println("  Destino: " + envio.getDestino());
                System.out.println("  Maletas: " + envio.getCantidadMaletas());
                System.out.println("  Fecha inicio: " + envio.getDiaHoraIngreso());
            }

            System.out.println(" Ruta:");
            for (VueloAsignado v : ruta.getVuelos()) {
                System.out.println("    " + v.getOrigen() + " -> " + v.getDestino());
                System.out.println("      Fecha: " + v.getFecha());
                System.out.println("      Salida: " + v.getHoraSalida());
                System.out.println("      Llegada: " + v.getHoraLlegada());
                System.out.println("      Maletas: " + v.getMaletasAsignadas());
                System.out.println("      Capacidad: " + v.getCapacidadMax());
            }

            System.out.printf("  Tiempo total: %.2f horas\n", ruta.getTiempoTotal());
            System.out.println("----------------------------------");
        }
    }
}