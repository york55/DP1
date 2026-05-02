import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class LectorEnviosPorLotes {

    private BufferedReader br;
    private Map<String, Aeropuerto> aeropuertos;
    private String origen;
    private Aeropuerto aeropuertoOrigen;

    private LocalDate fechaDesde;
    private LocalDate fechaHasta;

    private boolean finDeRango = false;

    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos) throws IOException {
        this.br = new BufferedReader(new FileReader(archivo));
        this.aeropuertos = aeropuertos;

        this.origen = LectorArchivos.extraerOrigenDesdeNombre(archivo.getName());
        this.aeropuertoOrigen = aeropuertos.get(origen);
    }

    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos,
                                 LocalDate fechaDesde, LocalDate fechaHasta) throws IOException {
        this.br = new BufferedReader(new FileReader(archivo));
        this.aeropuertos = aeropuertos;
        this.origen = LectorArchivos.extraerOrigenDesdeNombre(archivo.getName());
        this.aeropuertoOrigen = aeropuertos.get(origen);
        this.fechaDesde = fechaDesde;
        this.fechaHasta = fechaHasta;
    }

    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos,
                                 LocalDate fecha) throws IOException {
        this(archivo, aeropuertos, fecha, fecha);
    }

    public List<Envio> siguienteLote(int tamaño) throws IOException {
        List<Envio> lote = new ArrayList<>(tamaño);

        if (finDeRango) return null;

        String linea;
        while ((linea = br.readLine()) != null) {
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;

            EstadoFecha estado = evaluarFecha(linea);

            if (estado == EstadoFecha.ANTES_DE_RANGO) {
                continue; 
            }
            if (estado == EstadoFecha.DESPUES_DE_RANGO) {
                finDeRango = true; 
                break;
            }

            List<Envio> enviosLinea = LectorArchivos.parsearLineaEnvioConOrigen(
                linea, origen, aeropuertoOrigen, aeropuertos
            );
            if (enviosLinea != null) {
                for (Envio e : enviosLinea) {
                    lote.add(e);
                    if (lote.size() == tamaño) break;
                }
            }
            if (lote.size() == tamaño) break;
        }

        return lote.isEmpty() ? null : lote;
    }

    private EstadoFecha evaluarFecha(String linea) {
        if (fechaDesde == null && fechaHasta == null) return EstadoFecha.EN_RANGO;

        String[] partes = linea.split("-");
        if (partes.length < 2) return EstadoFecha.EN_RANGO;

        try {
            String fechaStr = partes[1]; 
            LocalDate fecha = LocalDate.of(
                Integer.parseInt(fechaStr.substring(0, 4)),
                Integer.parseInt(fechaStr.substring(4, 6)),
                Integer.parseInt(fechaStr.substring(6, 8))
            );

            if (fechaDesde != null && fecha.isBefore(fechaDesde)) return EstadoFecha.ANTES_DE_RANGO;
            if (fechaHasta != null && fecha.isAfter(fechaHasta))  return EstadoFecha.DESPUES_DE_RANGO;
            return EstadoFecha.EN_RANGO;

        } catch (Exception e) {
            return EstadoFecha.EN_RANGO; 
        }
    }

    private enum EstadoFecha {
        ANTES_DE_RANGO,
        EN_RANGO,
        DESPUES_DE_RANGO
    }

    public void cerrar() throws IOException {
        br.close();
    }
}
