import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

public class LectorArchivosEnvios {
    
    // ============================================
    // LEER TODOS LOS ARCHIVOS DE ENVIOS DE UNA CARPETA
    // ============================================
    public static List<Envio> leerEnviosDesdeCarpeta(String carpetaPath) throws IOException {
        List<Envio> todosEnvios = new ArrayList<>();
        File carpeta = new File(carpetaPath);
        
        if (!carpeta.exists() || !carpeta.isDirectory()) {
            System.err.println("Carpeta no encontrada: " + carpetaPath);
            return todosEnvios;
        }
        
        // Buscar archivos que empiezan con "_envios_" y terminan con "_"
        File[] archivos = carpeta.listFiles((dir, name) -> 
            name.startsWith("_envios_") && name.endsWith(".txt"));
        
        if (archivos == null || archivos.length == 0) {
            System.err.println("No se encontraron archivos de envios en: " + carpetaPath);
            return todosEnvios;
        }
        
        System.out.println("Encontrados " + archivos.length + " archivos de envios");
        
        for (File archivo : archivos) {
            // Extraer codigo de aeropuerto desde nombre: _envios_EBCI_ -> EBCI
            String origen = extraerOrigenDesdeNombre(archivo.getName());
            System.out.println("  Procesando: " + archivo.getName() + " (origen: " + origen + ")");
            
            List<Envio> enviosArchivo = leerEnviosDesdeArchivo(archivo, origen);
            todosEnvios.addAll(enviosArchivo);
            System.out.println("    Cargados " + enviosArchivo.size() + " envios");
        }
        
        return todosEnvios;
    }
    
    // ============================================
    // EXTRAER CODIGO DE AEROPUERTO DESDE NOMBRE
    // ============================================
    private static String extraerOrigenDesdeNombre(String nombreArchivo) {
        // Formato: _envios_EBCI_.txt
        // Quitar extension
        String sinExtension = nombreArchivo.replace(".txt", "");
        
        // Separar por guion bajo
        String[] partes = sinExtension.split("_");
        
        // partes[0] = "" (vacio por el _ inicial)
        // partes[1] = "envios"
        // partes[2] = "EBCI" (el codigo)
        if (partes.length >= 3) {
            return partes[2];
        }
        
        // Fallback: buscar cualquier texto entre _ y _
        int inicio = sinExtension.indexOf("_", 1) + 1;  // despues de _envios_
        int fin = sinExtension.lastIndexOf("_");
        if (inicio > 0 && fin > inicio) {
            return sinExtension.substring(inicio, fin);
        }
        
        return "DESCONOCIDO";
    }
    
    // ============================================
    // LEER UN ARCHIVO DE ENVIOS
    // ============================================
    private static List<Envio> leerEnviosDesdeArchivo(File archivo, String origen) throws IOException {
        List<Envio> envios = new ArrayList<>();
        List<String> lineas = Files.readAllLines(archivo.toPath(), StandardCharsets.UTF_8);
        
        for (String linea : lineas) {
            // Saltar lineas vacias
            if (linea.trim().isEmpty()) continue;
            
            Envio envio = parsearLineaEnvio(linea, origen);
            if (envio != null) {
                envios.add(envio);
            }
        }
        
        return envios;
    }
    
    // ============================================
    // PARSEAR UNA LINEA DE ENVIO
    // ============================================
    private static Envio parsearLineaEnvio(String linea, String origen) {
        try {
            // Formato esperado: id_envio-aaaammdd-hh-mm-dest-###-id_cliente
            // Ejemplo: 00000001-20250102-01-38-EBCI-006-0007729
            String[] partes = linea.split("-");
            
            if (partes.length < 7) {
                System.err.println("  Formato invalido: " + linea);
                return null;
            }
            
            int idEnvio = Integer.parseInt(partes[0]);
            String fechaStr = partes[1];
            int hora = Integer.parseInt(partes[2]);
            int minuto = Integer.parseInt(partes[3]);
            String destino = partes[4];
            int cantidadMaletas = Integer.parseInt(partes[5]);
            // partes[6] = id_cliente (opcional, se puede ignorar)
            
            // Construir LocalDateTime
            int anio = Integer.parseInt(fechaStr.substring(0, 4));
            int mes = Integer.parseInt(fechaStr.substring(4, 6));
            int dia = Integer.parseInt(fechaStr.substring(6, 8));
            
            LocalDateTime fechaHora = LocalDateTime.of(anio, mes, dia, hora, minuto);
            
            return new Envio(idEnvio, origen, destino, fechaHora, cantidadMaletas);
            
        } catch (Exception e) {
            System.err.println("  Error parseando envio: " + linea);
            System.err.println("    " + e.getMessage());
            return null;
        }
    }
}