import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

public class LectorArchivos {
    
    // ============================================
    // 1. LEER AEROPUERTOS DESDE ARCHIVO
    // ============================================
    public static Map<String,Aeropuerto> leerAeropuertos(String rutaArchivo) throws IOException {
        Map<String,Aeropuerto> aeropuertos = new HashMap<>();
        List<String> lineas = Files.readAllLines(Paths.get(rutaArchivo), StandardCharsets.UTF_8);
        
        int id = 0;
        for (String linea : lineas) {
            // Saltar lineas vacias o comentarios
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
            
            // Formato: codigo,continente,capacidad
            String[] partes = linea.split(",");
            if (partes.length >= 2) {
                String codigo = partes[0].trim();
                String continente = partes[1].trim();
                aeropuertos.put(codigo,new Aeropuerto(id,codigo, continente));
                id++;
            }
        }
        return aeropuertos;
    }
    
    // ============================================
    // 2. LEER VUELOS DESDE ARCHIVO
    // ============================================
    public static List<Vuelo> leerVuelos(String rutaArchivo,Map<String,Aeropuerto> aeropuertos) throws IOException {
        List<Vuelo> vuelos = new ArrayList<>();
        List<String> lineas = Files.readAllLines(Paths.get(rutaArchivo), StandardCharsets.UTF_8);
        int id = 1;
        
        for (String linea : lineas) {
            // Saltar lineas vacias o comentarios
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
            
            // Formato: ORIGEN-DESTINO-HH:MM-HH:MM-CAPACIDAD
            // Ejemplo: MAD-CDG-08:00-09:30-100
            String[] partes = linea.split("-");
            if (partes.length >= 5) {
                String origen = partes[0].trim();
                String destino = partes[1].trim();
                LocalTime horaSalida = LocalTime.parse(partes[2].trim());
                LocalTime horaLlegada = LocalTime.parse(partes[3].trim());
                int capacidad = Integer.parseInt(partes[4].trim());
                
                //Obtener ambos aeropuertos
                Aeropuerto aero_origen = aeropuertos.get(origen);
                Aeropuerto aero_destino = aeropuertos.get(destino);

                String vueloId = "V" + id;
                vuelos.add(new Vuelo(id,aero_origen,aero_destino, vueloId, origen, destino, horaSalida, horaLlegada, capacidad));
                id++;
            }
        }
        return vuelos;
    }
    
    // ============================================
    // 3. LEER ENVIOS DESDE ARCHIVO
    // ============================================
    public static List<Envio> leerEnvios(String rutaArchivo) throws IOException {
        List<Envio> envios = new ArrayList<>();
        List<String> lineas = Files.readAllLines(Paths.get(rutaArchivo), StandardCharsets.UTF_8);
        
        for (String linea : lineas) {
            // Saltar lineas vacias o comentarios
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
            
            // Formato: id_envio-aaaammdd-hh-mm-dest-###-id_cliente
            // Ejemplo: 00000001-20250102-01-38-EBCI-006-0007729
            Envio envio = parsearLineaEnvio(linea);
            if (envio != null) {
                envios.add(envio);
            }
        }
        return envios;
    }
    
    // ============================================
    // 4. PARSEAR UNA LINEA DE ENVIO
    // ============================================
    private static Envio parsearLineaEnvio(String linea) {
        try {
            String[] partes = linea.split("-");
            if (partes.length < 7) {
                System.err.println("Formato invalido: " + linea);
                return null;
            }
            
            // 00000001-20250102-01-38-EBCI-006-0007729
            // partes[0] = id_envio (00000001)
            // partes[1] = fecha (20250102)
            // partes[2] = hora (01)
            // partes[3] = minuto (38)
            // partes[4] = destino (EBCI)
            // partes[5] = cantidad (006)
            // partes[6] = id_cliente (0007729) - opcional
            
            int idEnvio = Integer.parseInt(partes[0]);
            String fechaStr = partes[1];  // aaaammdd
            int hora = Integer.parseInt(partes[2]);
            int minuto = Integer.parseInt(partes[3]);
            String destino = partes[4];
            int cantidadMaletas = Integer.parseInt(partes[5]);
            
            // Construir LocalDateTime desde fecha y hora
            int anio = Integer.parseInt(fechaStr.substring(0, 4));
            int mes = Integer.parseInt(fechaStr.substring(4, 6));
            int dia = Integer.parseInt(fechaStr.substring(6, 8));
            
            LocalDateTime fechaHora = LocalDateTime.of(anio, mes, dia, hora, minuto);
            
            // NOTA: El origen NO está en el archivo de envíos
            // El origen se define por el aeropuerto donde se recibe el archivo
            // Por ahora usamos un placeholder, se asignará después
            String origen = "DESCONOCIDO";
            
            return new Envio(idEnvio, origen, destino, fechaHora, cantidadMaletas);
            
        } catch (Exception e) {
            System.err.println("Error parseando envio: " + linea + " - " + e.getMessage());
            return null;
        }
    }
    
    // ============================================
    // 5. LEER ENVIOS DESDE MULTIPLES ARCHIVOS (uno por aeropuerto origen)
    // ============================================
    public static List<Envio> leerEnviosDesdeCarpeta(String carpetaPath) throws IOException {
        List<Envio> todosEnvios = new ArrayList<>();
        File carpeta = new File(carpetaPath);
        
        if (!carpeta.exists() || !carpeta.isDirectory()) {
            System.err.println("Carpeta no encontrada: " + carpetaPath);
            return todosEnvios;
        }
        
        // Buscar archivos que terminan en .txt Y empiezan con "_envios_"
        File[] archivos = carpeta.listFiles((dir, name) -> 
            name.endsWith(".txt") && name.startsWith("_envios_"));
        
        if (archivos == null || archivos.length == 0) {
            System.err.println("No se encontraron archivos _envios_*.txt en: " + carpetaPath);
            return todosEnvios;
        }
        
        System.out.println("Encontrados " + archivos.length + " archivos de envios");
        
        for (File archivo : archivos) {
            String nombreArchivo = archivo.getName();
            String origen = extraerOrigenDesdeNombre(nombreArchivo);
            System.out.println("  Procesando: " + nombreArchivo + " (origen: " + origen + ")");
            
            List<String> lineas = Files.readAllLines(archivo.toPath(), StandardCharsets.UTF_8);
            int contador = 0;
            
            for (String linea : lineas) {
                if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
                
                Envio envio = parsearLineaEnvioConOrigen(linea, origen);
                if (envio != null) {
                    todosEnvios.add(envio);
                    contador++;
                }
            }
            
            System.out.println("    Cargados " + contador + " envios");
        }
        
        return todosEnvios;
    }
    
    // ============================================
    // 6. EXTRAER ORIGEN DESDE NOMBRE DE ARCHIVO
    // ============================================
    private static String extraerOrigenDesdeNombre(String nombreArchivo) {
        // Eliminar extension
        String nombre = nombreArchivo.replace(".txt", "").replace(".csv", "");
        
        // Caso especial: _envios_EBCI_  -> EBCI
        if (nombre.startsWith("_envios_") && nombre.endsWith("_")) {
            // Quitar "_envios_" del principio y "_" del final
            String sinPrefijo = nombre.substring(8);  // "_envios_".length() = 8
            String codigo = sinPrefijo.substring(0, sinPrefijo.length() - 1);
            return codigo;
        }
        
        // Caso: "MAD_envios" -> "MAD"
        if (nombre.contains("_")) {
            String[] partes = nombre.split("_");
            if (partes[0].equals("envios") && partes.length > 1) {
                return partes[1];  // envios_MAD -> MAD
            }
            return partes[0];  // MAD_envios -> MAD
        }
        
        // Caso: "MAD" directamente
        return nombre;
    }

    /* ============================================
    // 7. LEER TODO DESDE UNA CARPETA DE CONFIGURACION
    // ============================================
    public static Configuracion leerConfiguracionCompleta(String carpetaConfig) throws IOException {
        Configuracion config = new Configuracion();
        
        File dir = new File(carpetaConfig);
        if (!dir.exists()) {
            throw new IOException("Carpeta no encontrada: " + carpetaConfig);
        }
        
        for (File archivo : dir.listFiles()) {
            String nombre = archivo.getName().toLowerCase();
            
            if (nombre.contains("aeropuerto") || nombre.contains("airport")) {
                config.aeropuertos = leerAeropuertos(archivo.getPath());
            }
            else if (nombre.contains("vuelo") || nombre.contains("flight")) {
                config.vuelos = leerVuelos(archivo.getPath());
            }
        }
        
        // Buscar archivos de envios (formato _envios_CODIGO_.txt)
        File[] enviosArchivos = dir.listFiles((f, name) -> 
            name.startsWith("_envios_") && name.endsWith(".txt"));
        
        if (enviosArchivos != null && enviosArchivos.length > 0) {
            // Si hay archivos _envios_* en la carpeta principal, usarlos
            config.envios = new ArrayList<>();
            for (File archivo : enviosArchivos) {
                String origen = extraerOrigenDesdeNombre(archivo.getName());
                List<String> lineas = Files.readAllLines(archivo.toPath(), StandardCharsets.UTF_8);
                
                for (String linea : lineas) {
                    if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
                    Envio envio = parsearLineaEnvioConOrigen(linea, origen);
                    if (envio != null) {
                        config.envios.add(envio);
                    }
                }
            }
        } else {
            // Fallback: buscar carpeta envios_por_origen
            File enviosDir = new File(carpetaConfig, "envios_por_origen");
            if (enviosDir.exists() && enviosDir.isDirectory()) {
                config.envios = leerEnviosDesdeCarpeta(enviosDir.getPath());
            }
        }
        
        return config;
    }
    
    */// ============================================
    // 4b. PARSEAR UNA LINEA DE ENVIO CON ORIGEN EXPLICITO
    // ============================================
    private static Envio parsearLineaEnvioConOrigen(String linea, String origen) {
        try {
            String[] partes = linea.split("-");
            if (partes.length < 7) {
                System.err.println("  Formato invalido: " + linea);
                return null;
            }
            
            // 00000001-20250102-01-38-EBCI-006-0007729
            int idEnvio = Integer.parseInt(partes[0]);
            String fechaStr = partes[1];
            int hora = Integer.parseInt(partes[2]);
            int minuto = Integer.parseInt(partes[3]);
            String destino = partes[4];
            int cantidadMaletas = Integer.parseInt(partes[5]);
            // partes[6] = id_cliente (se ignora)
            
            // Construir LocalDateTime
            int anio = Integer.parseInt(fechaStr.substring(0, 4));
            int mes = Integer.parseInt(fechaStr.substring(4, 6));
            int dia = Integer.parseInt(fechaStr.substring(6, 8));
            
            LocalDateTime fechaHora = LocalDateTime.of(anio, mes, dia, hora, minuto);
            
            return new Envio(idEnvio, origen, destino, fechaHora, cantidadMaletas);
            
        } catch (Exception e) {
            System.err.println("  Error parseando envio: " + linea);
            return null;
        }
    }
    /*s
    // ============================================
    // 8. CLASE DE CONFIGURACION
    // ============================================
    public static class Configuracion {
        public List<Aeropuerto> aeropuertos = new ArrayList<>();
        public List<Vuelo> vuelos = new ArrayList<>();
        public List<Envio> envios = new ArrayList<>();
        
        public void imprimirResumen() {
            System.out.println("=== CONFIGURACION CARGADA ===");
            System.out.println("Aeropuertos: " + aeropuertos.size());
            for (Aeropuerto a : aeropuertos) {
                System.out.println("  - " + a);
            }
            System.out.println("Vuelos: " + vuelos.size());
            for (Vuelo v : vuelos) {
                System.out.println("  - " + v);
            }
            System.out.println("Envios: " + envios.size());
            for (Envio e : envios) {
                System.out.println("  - " + e.getId() + ": " + e.getOrigen() + " -> " + e.getDestino());
            }
        }
    }
    */
}