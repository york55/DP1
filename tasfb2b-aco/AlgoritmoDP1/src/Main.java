import java.io.*;
import java.lang.management.ManagementFactory;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import com.sun.management.OperatingSystemMXBean;

public class Main {

    public static void main(String[] args) {
        if (args.length > 0 && args[0].equals("experiment")) {
            runExperiment(args);
        } else {
            runNormal();
        }
    }

    // ================================================================
    // MODO NORMAL — comportamiento original
    // ================================================================
    private static void runNormal() {
        try {
            String currentDir = System.getProperty("user.dir");
            Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");
            Path aeropath = basePath.resolve("aeropuertos.txt");
            Path vuelospath = basePath.resolve("vuelos.txt");
            Path enviosdir = basePath.resolve("envios_por_origen");

            if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                System.err.println("ERROR: Archivos no encontrados en " + basePath);
                return;
            }

            Map<String, Aeropuerto> aeropuertos = LectorArchivos.leerAeropuertos(aeropath.toString());
            List<Vuelo> vuelos = LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);
            List<Envio> envios = LectorArchivos.leerEnviosDesdeCarpeta(enviosdir.toString());

            ACO_Traslados aco = new ACO_Traslados(20, 8, 10, 1.0, 2.0, 0.1, 1.0, 0.01);
            MatrizFeromonas3D feromonas = new MatrizFeromonas3D(aeropuertos.size(), 0.01);
            aco.inicializar(new ArrayList<>(aeropuertos.values()), vuelos, feromonas);

            long inicioBloque1000 = System.nanoTime();
            int nro_envios = 0;
            int totalSinRuta = 0;
            int totalConRuta = 0;
            int loteSize = 10;
            int totalEnvios = envios.size();

            System.out.println("Procesando " + totalEnvios + " envíos en lotes de " + loteSize + "...");

            long inicioGlobal = System.nanoTime();
            for (int i = 0; i < totalEnvios; i += loteSize) {
                int fin = Math.min(i + loteSize, totalEnvios);
                List<Envio> subLista = envios.subList(i, fin);

                SolucionLoteACO resultadoLote = aco.ejecutarLote(subLista);

                totalConRuta += (subLista.size() - resultadoLote.getEnviosFallidos());
                totalSinRuta += resultadoLote.getEnviosFallidos();
                nro_envios += subLista.size();

                if (nro_envios % 1000 == 0 || nro_envios == totalEnvios) {
                    imprimirProgreso(nro_envios, totalEnvios, totalConRuta, totalSinRuta, inicioGlobal, inicioBloque1000);
                    resultadoLote.imprimirDetalleLote();
                    inicioBloque1000 = System.nanoTime();
                }
            }

            System.out.println("\n===== RESUMEN FINAL =====");
            System.out.println("Total procesados: " + nro_envios);
            System.out.println("Éxito total:      " + totalConRuta);
            System.out.println("Fallidos total:   " + totalSinRuta);
            System.out.println("=========================");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ================================================================
    // MODO EXPERIMENTO — ejecuta N iteraciones y guarda CSV
    // Uso: java Main experiment --days 3 --iterations 10 --output exp_3_day_results.csv
    // ================================================================
    private static void runExperiment(String[] args) {
        // --- Parsear argumentos ---
        int days = 3;
        int iterations = 10;
        String outputFile = "exp_results.csv";

        for (int i = 1; i < args.length; i++) {
            switch (args[i]) {
                case "--days":       days = Integer.parseInt(args[++i]); break;
                case "--iterations": iterations = Integer.parseInt(args[++i]); break;
                case "--output":     outputFile = args[++i]; break;
            }
        }

        System.out.println("╔══════════════════════════════════════════════════╗");
        System.out.println("║       ACO EXPERIMENT RUNNER                     ║");
        System.out.println("╠══════════════════════════════════════════════════╣");
        System.out.println("║  Dias          : " + days);
        System.out.println("║  Iteraciones   : " + iterations);
        System.out.println("║  Output        : " + outputFile);
        System.out.println("╚══════════════════════════════════════════════════╝");
        System.out.println();

        try {
            // --- Verificar datos ---
            String currentDir = System.getProperty("user.dir");
            Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");
            Path aeropath = basePath.resolve("aeropuertos.txt");
            Path vuelospath = basePath.resolve("vuelos.txt");
            Path enviosdir = basePath.resolve("envios_por_origen");

            if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                System.err.println("ERROR: Archivos no encontrados en " + basePath);
                System.err.println("  Asegurate de ejecutar desde el directorio AlgoritmoDP1/");
                return;
            }

            // --- Escribir header del CSV ---
            try (PrintWriter pw = new PrintWriter(new FileWriter(outputFile, false))) {
                pw.println("Iteracion,Tiempo_Ejecucion,Tiempo_Entrega,Consumo_Memoria,Consumo_CPU");
            }

            OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
            int availableProcessors = Runtime.getRuntime().availableProcessors();

            // Acumuladores para resumen
            long sumTiempo = 0;
            double sumRam = 0;
            double sumCpu = 0;
            int exitosas = 0;

            for (int iter = 1; iter <= iterations; iter++) {
                System.out.println("── Iteración " + iter + "/" + iterations + " ──");

                try {
                    // Recargar datos frescos para cada iteración (ACO modifica capacidades)
                    Map<String, Aeropuerto> aeropuertos = LectorArchivos.leerAeropuertos(aeropath.toString());
                    List<Vuelo> vuelos = LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);
                    List<Envio> todosEnvios = LectorArchivos.leerEnviosDesdeCarpeta(enviosdir.toString());

                    // Filtrar envíos por rango de días
                    List<Envio> envios = filtrarEnviosPorDias(todosEnvios, days);
                    System.out.println("   Envios filtrados: " + envios.size() + " de " + todosEnvios.size() + " (periodo: " + days + " dias)");

                    // Medir CPU y RAM antes
                    Runtime rt = Runtime.getRuntime();
                    rt.gc();
                    long cpuTimeBefore = osBean.getProcessCpuTime();
                    long wallTimeBefore = System.nanoTime();
                    long ramBefore = rt.totalMemory() - rt.freeMemory();

                    // --- Ejecutar ACO ---
                    ACO_Traslados aco = new ACO_Traslados(20, 8, 10, 1.0, 2.0, 0.1, 1.0, 0.01);
                    MatrizFeromonas3D feromonas = new MatrizFeromonas3D(aeropuertos.size(), 0.01);
                    aco.inicializar(new ArrayList<>(aeropuertos.values()), vuelos, feromonas);

                    int loteSize = 10;
                    int totalConRuta = 0;
                    int totalSinRuta = 0;
                    double totalTiempoEntregaHoras = 0;
                    Map<Integer, Ruta> todasLasRutas = new HashMap<>();

                    for (int i = 0; i < envios.size(); i += loteSize) {
                        int fin = Math.min(i + loteSize, envios.size());
                        List<Envio> subLista = envios.subList(i, fin);
                        SolucionLoteACO resultado = aco.ejecutarLote(subLista);

                        totalConRuta += (subLista.size() - resultado.getEnviosFallidos());
                        totalSinRuta += resultado.getEnviosFallidos();

                        // Acumular rutas para calcular tiempo de entrega
                        for (Map.Entry<Integer, Ruta> entry : resultado.getAsignaciones().entrySet()) {
                            Ruta ruta = entry.getValue();
                            if (ruta != null && !ruta.isEmpty()) {
                                totalTiempoEntregaHoras += ruta.getTiempoTotal();
                                todasLasRutas.put(entry.getKey(), ruta);
                            }
                        }
                    }

                    // Medir CPU y RAM después
                    long wallTimeAfter = System.nanoTime();
                    long cpuTimeAfter = osBean.getProcessCpuTime();
                    long ramAfter = rt.totalMemory() - rt.freeMemory();

                    // Calcular métricas
                    long tiempoEjecucionMs = (wallTimeAfter - wallTimeBefore) / 1_000_000;
                    double tiempoEntregaMin = totalTiempoEntregaHoras * 60.0;
                    double ramPromedioMb = ((ramBefore + ramAfter) / 2.0) / (1024.0 * 1024.0);

                    double cpuPct = 0;
                    long wallElapsed = wallTimeAfter - wallTimeBefore;
                    long cpuElapsed = cpuTimeAfter - cpuTimeBefore;
                    if (wallElapsed > 0) {
                        cpuPct = ((double) cpuElapsed / (double) wallElapsed) * 100.0 / availableProcessors;
                    }

                    // Escribir fila al CSV
                    try (PrintWriter pw = new PrintWriter(new FileWriter(outputFile, true))) {
                        pw.printf("%d,%d,%.2f,%.2f,%.2f%n",
                            iter,
                            tiempoEjecucionMs,
                            tiempoEntregaMin,
                            ramPromedioMb,
                            cpuPct
                        );
                    }

                    sumTiempo += tiempoEjecucionMs;
                    sumRam += ramPromedioMb;
                    sumCpu += cpuPct;
                    exitosas++;

                    System.out.printf("   ✔ Tiempo: %d ms | Entrega: %.0f min | RAM: %.2f MB | CPU: %.1f%% | Rutas: %d/%d%n",
                        tiempoEjecucionMs, tiempoEntregaMin, ramPromedioMb, cpuPct, totalConRuta, totalConRuta + totalSinRuta);
                    System.out.println();

                } catch (Exception e) {
                    System.err.println("   ✘ ERROR en iteración " + iter + ": " + e.getMessage());
                    try (PrintWriter pw = new PrintWriter(new FileWriter(outputFile, true))) {
                        pw.println(iter + ",ERROR,ERROR,ERROR,ERROR");
                    } catch (IOException ioEx) {
                        ioEx.printStackTrace();
                    }
                    System.out.println();
                }
            }

            // Resumen final
            System.out.println("╔══════════════════════════════════════════════════╗");
            System.out.println("║                 RESUMEN FINAL                   ║");
            System.out.println("╠══════════════════════════════════════════════════╣");
            if (exitosas > 0) {
                System.out.printf("║  Iteraciones exitosas: %d/%d%n", exitosas, iterations);
                System.out.printf("║  Tiempo promedio     : %d ms%n", sumTiempo / exitosas);
                System.out.printf("║  RAM promedio        : %.2f MB%n", sumRam / exitosas);
                System.out.printf("║  CPU promedio        : %.1f%%%n", sumCpu / exitosas);
            } else {
                System.out.println("║  No se completaron iteraciones exitosas.");
            }
            System.out.println("║  Resultados en       : " + outputFile);
            System.out.println("╚══════════════════════════════════════════════════╝");

        } catch (Exception e) {
            System.err.println("Error fatal: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // ================================================================
    // Filtrar envíos por rango de días desde la fecha más temprana
    // ================================================================
    private static List<Envio> filtrarEnviosPorDias(List<Envio> envios, int dias) {
        if (envios.isEmpty()) return envios;

        // Encontrar la fecha más temprana
        LocalDateTime fechaMin = envios.stream()
            .map(Envio::getDiaHoraIngreso)
            .min(LocalDateTime::compareTo)
            .orElse(LocalDateTime.now());

        // Calcular fecha límite (inicio del día + N días)
        LocalDateTime fechaInicio = fechaMin.toLocalDate().atStartOfDay();
        LocalDateTime fechaLimite = fechaInicio.plusDays(dias);

        List<Envio> filtrados = envios.stream()
            .filter(e -> e.getDiaHoraIngreso().isBefore(fechaLimite))
            .collect(Collectors.toList());

        System.out.println("   Rango de fechas: " + fechaInicio.toLocalDate() + " a " + fechaLimite.toLocalDate());
        return filtrados;
    }

    // ================================================================
    // Progreso (modo normal)
    // ================================================================
    private static void imprimirProgreso(int actual, int total, int conRuta, int sinRuta, long inicioGlobal, long inicioBloque) {
        long ahora = System.nanoTime();
        double totalSeg = (ahora - inicioGlobal) / 1_000_000_000.0;
        double bloqueSeg = (ahora - inicioBloque) / 1_000_000_000.0;

        System.out.printf("\rPROGRESO: %d/%d | Con Ruta: %d | Sin Ruta: %d | T. Lote: %.2fs | T. Total: %.2fs",
                          actual, total, conRuta, sinRuta, bloqueSeg, totalSeg);
        if (actual % 1000 == 0) System.out.println();
    }
}