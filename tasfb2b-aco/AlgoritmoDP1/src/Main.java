import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        try {
            // 1. Configuración de Rutas (Mantienes tu lógica actual)
            String currentDir = System.getProperty("user.dir");
            Path basePath = Paths.get(currentDir).resolve("src").resolve("datos");
            Path aeropath = basePath.resolve("aeropuertos.txt");
            Path vuelospath = basePath.resolve("vuelos.txt");
            Path enviosdir = basePath.resolve("envios_por_origen");

            if (!Files.exists(aeropath) || !Files.exists(enviosdir) || !Files.exists(vuelospath)) {
                System.err.println("ERROR: Archivos no encontrados.");
                return;
            }

            // 2. Carga de Datos
            Map<String, Aeropuerto> aeropuertos = LectorArchivos.leerAeropuertos(aeropath.toString());
            List<Vuelo> vuelos = LectorArchivos.leerVuelos(vuelospath.toString(), aeropuertos);
            List<Envio> envios = LectorArchivos.leerEnviosDesdeCarpeta(enviosdir.toString());

            // 3. Configurar ACO
            ACO_Traslados aco = new ACO_Traslados(20, 8, 10, 1.0, 2.0, 0.1, 1.0, 0.01);
            MatrizFeromonas3D feromonas = new MatrizFeromonas3D(aeropuertos.size(), 0.01);
            aco.inicializar(new ArrayList<>(aeropuertos.values()), vuelos, feromonas);

            // 4. Variables de Control
            long inicioBloque1000 = System.nanoTime();
            int nro_envios = 0;
            int totalSinRuta = 0;
            int totalConRuta = 0;
            int loteSize = 10;
            int totalEnvios = envios.size();

            System.out.println("Procesando " + totalEnvios + " envíos en lotes de " + loteSize + "...");

            long inicioGlobal = System.nanoTime();
            // 5. FLUJO POR LOTES USANDO SolucionLoteACO
            for (int i = 0; i < totalEnvios; i += loteSize) {
                int fin = Math.min(i + loteSize, totalEnvios);
                List<Envio> subLista = envios.subList(i, fin);

                // Llamada al nuevo método (asumiendo que devuelve SolucionLoteACO)
                SolucionLoteACO resultadoLote = aco.ejecutarLote(subLista);

                // Acumulamos estadísticas desde el objeto de solución
                totalConRuta += (subLista.size() - resultadoLote.getEnviosFallidos());
                totalSinRuta += resultadoLote.getEnviosFallidos();
                nro_envios += subLista.size();

                // Reporte de Progreso cada 1000 envíos
                if (nro_envios % 1000 == 0 || nro_envios == totalEnvios) {
                    imprimirProgreso(nro_envios, totalEnvios, totalConRuta, totalSinRuta, inicioGlobal, inicioBloque1000);

                    // imprimir detalle del último lote
                    resultadoLote.imprimirDetalleLote();

                    inicioBloque1000 = System.nanoTime();
                }
            }

            // 6. Resumen Final
            System.out.println("\n===== RESUMEN FINAL =====");
            System.out.println("Total procesados: " + nro_envios);
            System.out.println("Éxito total:      " + totalConRuta);
            System.out.println("Fallidos total:   " + totalSinRuta);
            System.out.println("=========================");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void imprimirProgreso(int actual, int total, int conRuta, int sinRuta, long inicioGlobal, long inicioBloque) {
        long ahora = System.nanoTime();
        double totalSeg = (ahora - inicioGlobal) / 1_000_000_000.0;
        double bloqueSeg = (ahora - inicioBloque) / 1_000_000_000.0;
        
        System.out.printf("\rPROGRESO: %d/%d | Con Ruta: %d | Sin Ruta: %d | T. Lote: %.2fs | T. Total: %.2fs", 
                          actual, total, conRuta, sinRuta, bloqueSeg, totalSeg);
        if (actual % 1000 == 0) System.out.println(); // Salto de línea cada 1000
    }
}
*/