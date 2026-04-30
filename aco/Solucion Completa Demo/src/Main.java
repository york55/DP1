package src;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.lang.management.ManagementFactory;
import com.sun.management.OperatingSystemMXBean;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.*;

public class Main {

    public static void main(String[] args) {
        try {

            int TOTAL_EJECUCIONES = 30;

            // ===== CSV =====
            String csvPath = "metricas.csv";
            PrintWriter writer = new PrintWriter(new FileWriter(csvPath));
            writer.println("Iteracion,Tiempo_Ejecucion,Tiempo_Entrega,Consumo_Memoria,Consumo_CPU");

            Runtime rt = Runtime.getRuntime();

            OperatingSystemMXBean osBean =
                    (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

            for (int iteracionGlobal = 1; iteracionGlobal <= TOTAL_EJECUCIONES; iteracionGlobal++) {

                System.out.println("\n==============================");
                System.out.println("EJECUCIÓN GLOBAL #" + iteracionGlobal);
                System.out.println("==============================");

                // ===== MEDICIÓN INICIO =====
                long startTime = System.currentTimeMillis();
                long memStart = rt.totalMemory() - rt.freeMemory();

                // Warm-up CPU
                osBean.getProcessCpuLoad();

                String currentDir = System.getProperty("user.dir");
                Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");

                Path aeropath = basePath.resolve("aeropuertos.txt");
                Path vuelospath = basePath.resolve("vuelos.txt");
                Path enviosdir = basePath.resolve("envios_por_origen");

                if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                    System.err.println("ERROR: Archivos no encontrados.");
                    return;
                }

                Map<String, Aeropuerto> aeropuertos =
                        LectorArchivos.leerAeropuertos(aeropath.toString());

                List<VueloDiario> vuelos =
                        LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);

                ACO aco = new ACO(
                        30, 30, 1.0, 2.0, 0.1, 100, 0.01,
                        aeropuertos, vuelos
                );

                File carpeta = enviosdir.toFile();
                File[] archivos = carpeta.listFiles((dir, name) ->
                        name.endsWith(".txt") && name.startsWith("_envios_")
                );

                if (archivos == null || archivos.length == 0) {
                    System.err.println("No hay archivos de envios.");
                    return;
                }

                LocalDate dia = LocalDate.of(2026, 1, 2);

                int totalGlobalProcesados = 0;
                int totalGlobalFallos = 0;

                for (File archivo : archivos) {

                    LectorEnviosPorLotes lector = new LectorEnviosPorLotes(
                            archivo, aeropuertos, dia, dia.plusDays(3)
                    );

                    List<Envio> lote;

                    while ((lote = lector.siguienteLote(10)) != null) {
                        for (Envio envio : lote) {

                            RutaEnvio ruta = aco.ejecutar(envio);

                            if (ruta != null) {
                                totalGlobalProcesados++;
                            } else {
                                totalGlobalFallos++;
                            }

                            if (totalGlobalProcesados % 10 == 0) {
                                System.out.println("Proceso 10");
                            }
                        }
                    }
                    lector.cerrar();
                }

                // ===== MEDICIÓN FINAL =====
                long executionTime = System.currentTimeMillis() - startTime;

                // Espera mínima para estabilizar medición CPU
                Thread.sleep(200);

                double cpuUsagePct = osBean.getProcessCpuLoad() * 100.0;

                long memEnd = rt.totalMemory() - rt.freeMemory();
                double ramPromedioMb = (memStart + memEnd) / 2.0 / (1024 * 1024);

                long tiempoEntrega = executionTime;

                // ===== GUARDAR CSV =====
                writer.println(iteracionGlobal + "," +
                        executionTime + "," +
                        tiempoEntrega + "," +
                        ramPromedioMb + "," +
                        cpuUsagePct);

                System.out.printf("Iteración %d -> Tiempo: %d ms | CPU: %.2f%% | RAM: %.2f MB%n",
                        iteracionGlobal, executionTime, cpuUsagePct, ramPromedioMb);
            }

            writer.close();

            System.out.println("\nCSV generado en: " + Paths.get("metricas.csv").toAbsolutePath());
            System.out.println("Proceso terminado (" + TOTAL_EJECUCIONES + " ejecuciones).");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
/*package src;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Main {

    public static void main(String[] args) {
        try {
            String currentDir = System.getProperty("user.dir");
            Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");

            Path aeropath = basePath.resolve("aeropuertos.txt");
            Path vuelospath = basePath.resolve("vuelos.txt");
            Path enviosdir = basePath.resolve("envios_por_origen");

            if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                System.err.println("ERROR: Archivos no encontrados.");
                return;
            }

            // Leer data
            Map<String, Aeropuerto> aeropuertos =
                    LectorArchivos.leerAeropuertos(aeropath.toString());

            List<VueloDiario> vuelos =
                    LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);

            // Inicializar ACO
            ACO aco = new ACO(
                    20,     // iteraciones
                    40,     // hormigas
                    1.0,    // alpha
                    2.0,    // beta
                    0.1,    // rho
                    100,    // Q
                    0.01,   // tau0
                    aeropuertos,
                    vuelos
            );

            File carpeta = enviosdir.toFile();
            File[] archivos = carpeta.listFiles((dir, name) ->
                    name.endsWith(".txt") && name.startsWith("_envios_")
            );

            if (archivos == null || archivos.length == 0) {
                System.err.println("No hay archivos de envios.");
                return;
            }

            LocalDate dia = LocalDate.of(2026, 1, 2);

            int totalGlobalProcesados = 0;
            int totalGlobalFallos = 0;
            long inicioTotal = System.currentTimeMillis();
            int aeropuertoNum = 0;

            System.out.println("╔══════════════════════════════════════════════════════╗");
            System.out.println("  Procesando envíos del día: " + dia);
            System.out.println("  Archivos encontrados: " + archivos.length);
            System.out.println("╚══════════════════════════════════════════════════════╝");

            for (File archivo : archivos) {
                aeropuertoNum++;
                String codigoAero = LectorArchivos.extraerOrigenDesdeNombre(archivo.getName());

                System.out.printf("%n[%d/%d] %-6s  %s%n",
                    aeropuertoNum, archivos.length,
                    codigoAero, archivo.getName()
                );

                LectorEnviosPorLotes lector = new LectorEnviosPorLotes(archivo, aeropuertos, dia,dia.plusDays(3));
                List<Envio> lote;
                List<RutaEnvio> rutas = new ArrayList<>();
                List<Envio> enviosFallaron = new ArrayList<>();
                int totalProcesados = 0;
                int fallos = 0;
                long inicioAero = System.currentTimeMillis();

                while ((lote = lector.siguienteLote(10)) != null) {
                    int fallosLote = 0; int totalProcesadosLotes = 0; long iniciLote = System.currentTimeMillis();
                    for (Envio envio : lote) {
                        RutaEnvio ruta = aco.ejecutar(envio);
                        rutas.add(ruta);
                        if (ruta != null){
                            totalProcesados++;
                            totalProcesadosLotes++;
                        }
                        else{
                            fallos++;
                            fallosLote++;
                            enviosFallaron.add(envio);
                        }
                        //System.out.println("========================================");
                        //imprimirDetalleRuta(envio, ruta);
                        //System.out.println("========================================");

                        if ((totalProcesados + fallos) % 10 == 0) {
                            long duracion = System.currentTimeMillis() - iniciLote;
                            System.out.printf("  │  +" + lote.size() + " envíos  ✓ %-5d  ✗ %-4d  %4d ms%n",
                                totalProcesadosLotes, fallosLote, duracion
                            );
                            iniciLote = System.currentTimeMillis();
                        }
                    }
                }
                lector.cerrar();

                long duracionAero = System.currentTimeMillis() - inicioAero;
                totalGlobalProcesados += totalProcesados;
                totalGlobalFallos     += fallos;

                System.out.printf("  ─────────────────────────────────────────%n");
                System.out.printf("    Resultado: ✓ %d rutas  ✗ %d fallos  |  %.2f s%n",
                    totalProcesados, fallos, duracionAero / 1000.0
                );
            }

            long duracionTotal = System.currentTimeMillis() - inicioTotal;
            System.out.println("\n╔══════════════════════════════════════════════════════╗");
            System.out.printf("  TOTAL  ✓ %d procesados  ✗ %d fallos%n",
                totalGlobalProcesados, totalGlobalFallos
            );
            System.out.printf("  Tiempo total: %.2f s  |  Aeropuertos: %d%n",
                duracionTotal / 1000.0, aeropuertoNum
            );
            System.out.println("╚══════════════════════════════════════════════════════╝");
            System.out.println("\nProceso terminado.");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ==============================
    // MÉTODO DE IMPRESIÓN
    // ==============================
    public static void imprimirDetalleRuta(Envio envio, RutaEnvio ruta) {
        System.out.println("Envio ID: " + envio.getId());
        System.out.println("Origen: " + envio.getOrigen());
        System.out.println("Destino: " + envio.getDestino());
        System.out.println("Hora de envio: " + envio.getDiaHoraIngreso().toLocalDate() + " " + envio.getDiaHoraIngreso().toLocalTime());
        System.out.println("Tiempo total: " + ruta.getTiempoTotal());

        System.out.println("Ruta:");

        for (VueloFecha vf : ruta.getVuelos()) {
            VueloDiario vuelo = vf.getVueloBase();

            System.out.println("  Fecha: " + vf.getFecha());
            System.out.println("    Vuelo ID: " + vuelo.getId());
            System.out.println("    Origen: " + vuelo.getOrigen().getCodigo());
            System.out.println("    Destino: " + vuelo.getDestino().getCodigo());
            System.out.println("    Hora salida: " + vuelo.getHoraSalida());
            System.out.println("    Hora llegada: " + vuelo.getHoraLlegada());
        }
        System.out.println("==============================");
    }
}

/*package src;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

public class Main {
    public static void main(String[] args){
        try{
            String currentDir = System.getProperty("user.dir");
            Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");
            Path aeropath = basePath.resolve("aeropuertos.txt");
            Path vuelospath = basePath.resolve("vuelos.txt");
            Path enviosdir = basePath.resolve("envios_por_origen");
            if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                System.err.println("ERROR: Archivos no encontrados.");
                return;
            }

            Map<String, Aeropuerto> aeropuertos =
                LectorArchivos.leerAeropuertos(aeropath.toString());
            List<VueloDiario> vuelos =
                LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);

            ACO aco = new ACO(
                50, 20, 1.0, 2.0, 0.1,
                100, 0.01, aeropuertos, vuelos
            );

            File carpeta = enviosdir.toFile();
            File[] archivos = carpeta.listFiles((dir, name) ->
                name.endsWith(".txt") && name.startsWith("_envios_")
            );
            if (archivos == null || archivos.length == 0) {
                System.err.println("No hay archivos de envios");
                return;
            }

            for (File archivo : archivos) {
                System.out.println("Procesando archivo: " + archivo.getName());
                LectorEnviosPorLotes lector =
                    new LectorEnviosPorLotes(archivo, aeropuertos);
                List<Envio> lote;
                while ((lote = lector.siguienteLote(2000)) != null) {
                    //var rutas = aco.ejecutar(lote);
                    //System.out.println("Rutas del lote: " + rutas);
                }
                lector.cerrar();
            }

            System.out.println("Proceso terminado.");

        } catch(Exception e){
            e.printStackTrace();
        }
    }
}
*/