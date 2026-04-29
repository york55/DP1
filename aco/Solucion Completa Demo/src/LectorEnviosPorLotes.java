package src;

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

    // NUEVO: rango de fechas (null = sin filtro)
    private LocalDate fechaDesde;
    private LocalDate fechaHasta;

    // Si es true, ya superamos fechaHasta y no tiene sentido seguir leyendo
    private boolean finDeRango = false;

    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos) throws IOException {
        this.br = new BufferedReader(new FileReader(archivo));
        this.aeropuertos = aeropuertos;

        this.origen = LectorArchivos.extraerOrigenDesdeNombre(archivo.getName());
        this.aeropuertoOrigen = aeropuertos.get(origen);
    }

    // NUEVO: Constructor con rango de fechas
    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos,
                                 LocalDate fechaDesde, LocalDate fechaHasta) throws IOException {
        this.br = new BufferedReader(new FileReader(archivo));
        this.aeropuertos = aeropuertos;
        this.origen = LectorArchivos.extraerOrigenDesdeNombre(archivo.getName());
        this.aeropuertoOrigen = aeropuertos.get(origen);
        this.fechaDesde = fechaDesde;
        this.fechaHasta = fechaHasta;
    }

    // NUEVO: Constructor para un solo día
    public LectorEnviosPorLotes(File archivo, Map<String, Aeropuerto> aeropuertos,
                                 LocalDate fecha) throws IOException {
        this(archivo, aeropuertos, fecha, fecha);
    }

    public List<Envio> siguienteLote(int tamaño) throws IOException {
        List<Envio> lote = new ArrayList<>(tamaño);

        // Si ya detectamos que superamos fechaHasta en un lote anterior, no leer más
        if (finDeRango) return null;

        String linea;
        while ((linea = br.readLine()) != null) {
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;

            EstadoFecha estado = evaluarFecha(linea);

            if (estado == EstadoFecha.ANTES_DE_RANGO) {
                continue; // aún no llegamos a fechaDesde, seguir leyendo
            }
            if (estado == EstadoFecha.DESPUES_DE_RANGO) {
                finDeRango = true; // ya pasamos fechaHasta, cortar todo
                break;
            }

            // estado == EN_RANGO (o sin filtro)
            Envio e = LectorArchivos.parsearLineaEnvioConOrigen(
                linea, origen, aeropuertoOrigen, aeropuertos
            );
            if (e != null) lote.add(e);
            if (lote.size() == tamaño) break;
        }

        return lote.isEmpty() ? null : lote;
    }

    // Evalúa solo el campo de fecha del string crudo, sin parsear el objeto completo
    private EstadoFecha evaluarFecha(String linea) {
        if (fechaDesde == null && fechaHasta == null) return EstadoFecha.EN_RANGO;

        String[] partes = linea.split("-");
        if (partes.length < 2) return EstadoFecha.EN_RANGO;

        try {
            String fechaStr = partes[1]; // "20250102"
            LocalDate fecha = LocalDate.of(
                Integer.parseInt(fechaStr.substring(0, 4)),
                Integer.parseInt(fechaStr.substring(4, 6)),
                Integer.parseInt(fechaStr.substring(6, 8))
            );

            if (fechaDesde != null && fecha.isBefore(fechaDesde)) return EstadoFecha.ANTES_DE_RANGO;
            if (fechaHasta != null && fecha.isAfter(fechaHasta))  return EstadoFecha.DESPUES_DE_RANGO;
            return EstadoFecha.EN_RANGO;

        } catch (Exception e) {
            return EstadoFecha.EN_RANGO; // si no se puede parsear, dejar pasar
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