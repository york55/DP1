import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

public class LectorArchivos {
    
    public static Map<String, Aeropuerto> leerAeropuertos(String rutaArchivo) throws IOException {
        Map<String, Aeropuerto> aeropuertos = new HashMap<>();

        List<String> lineas = Files.readAllLines(
            Paths.get(rutaArchivo),
            StandardCharsets.ISO_8859_1
        );

        int id = 0;
        String continenteActual = "";

        for (String linea : lineas) {
            linea = linea.replace("\0", "").replaceAll("[^\\x20-\\x7E\\xC0-\\xFF]", "").trim();
            if (linea.isEmpty() || linea.startsWith("#")) continue;

            // Detectar continente (formato referencia)
            if (linea.contains("America del Sur")) { continenteActual = "AMERICA"; }
            if (linea.contains("Europa"))           { continenteActual = "EUROPA";  }
            if (linea.contains("Asia"))             { continenteActual = "ASIA";    }

            // Intentar formato Comma-Separated (Target Project)
            // SKBO,America del Sur,430
            if (linea.contains(",")) {
                String[] partes = linea.split(",");
                if (partes.length >= 3) {
                    String codigo = partes[0].trim();
                    String continente = partes[1].trim();
                    int capacidad = Integer.parseInt(partes[2].trim());
                    // Default GMT to 0 for this format
                    aeropuertos.put(codigo, new Aeropuerto(id, 0, "", codigo, continente, capacidad));
                    id++;
                    continue;
                }
            }

            // Fallback: formato referencia (Espacios, empieza con digito)
            if (Character.isDigit(linea.charAt(0))) {
                int idxLat = linea.indexOf("Latitude:");
                if (idxLat != -1) linea = linea.substring(0, idxLat).trim();

                String[] partes = linea.trim().split("\\s+");
                if (partes.length >= 4) {
                    try {
                        String codigo   = partes[1];
                        int gmt         = Integer.parseInt(partes[partes.length - 2]);
                        int capacidad   = Integer.parseInt(partes[partes.length - 1]);
                        aeropuertos.put(codigo, new Aeropuerto(id, gmt, "", codigo, continenteActual, capacidad));
                        id++;
                    } catch (NumberFormatException e) {
                        // ignore
                    }
                }
            }
        }
        return aeropuertos;
    }
    
    public static List<VueloDiario> leerVuelos(String rutaArchivo, Map<String, Aeropuerto> aeropuertos) throws IOException {
        List<VueloDiario> vuelos = new ArrayList<>();
        List<String> lineas = Files.readAllLines(Paths.get(rutaArchivo), StandardCharsets.UTF_8);
        int id = 1;
        
        for (String linea : lineas) {
            if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
            
            String[] partes = linea.split("-");
            if (partes.length >= 5) {
                String origen = partes[0].trim();
                String destino = partes[1].trim();
                
                Aeropuerto aero_origen = aeropuertos.get(origen);
                Aeropuerto aero_destino = aeropuertos.get(destino);

                if (aero_origen == null || aero_destino == null) {
                    System.err.println("Advertencia: Aeropuerto no encontrado para el vuelo: " + linea);
                    continue;
                }

                LocalTime horaSalida = LocalTime.parse(partes[2].trim());
                LocalTime horaLlegada = LocalTime.parse(partes[3].trim());
                int capacidad = Integer.parseInt(partes[4].trim());
                
                horaSalida = horaSalida.plusHours(aero_origen.getGmt());
                horaLlegada = horaLlegada.plusHours(aero_origen.getGmt());

                vuelos.add(new VueloDiario(id, aero_origen, aero_destino, horaSalida, horaLlegada, capacidad));
                id++;
            }
        }
        return vuelos;
    }
    
    public static List<Envio> leerEnviosDesdeCarpeta(String carpetaPath,Map<String,Aeropuerto> aeropuertos) throws IOException {
        List<Envio> todosEnvios = new ArrayList<>();
        File carpeta = new File(carpetaPath);
        
        if (!carpeta.exists() || !carpeta.isDirectory()) {
            System.err.println("Carpeta no encontrada: " + carpetaPath);
            return todosEnvios;
        }
        
        File[] archivos = carpeta.listFiles((dir, name) -> 
            name.endsWith(".txt") && name.startsWith("_envios_"));
        
        if (archivos == null || archivos.length == 0) {
            System.err.println("No se encontraron archivos _envios_*.txt en: " + carpetaPath);
            return todosEnvios;
        }
        
        for (File archivo : archivos) {
            String nombreArchivo = archivo.getName();
            String origen = extraerOrigenDesdeNombre(nombreArchivo); 
            
            List<String> lineas = Files.readAllLines(archivo.toPath(), StandardCharsets.UTF_8);
            
            for (String linea : lineas) {
                if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
                Aeropuerto aeropuerto = aeropuertos.get(origen);
                Envio envio = parsearLineaEnvioConOrigen(linea, origen, aeropuerto, aeropuertos);
                if (envio != null) {
                    todosEnvios.add(envio);
                }
            }
        }
        
        return todosEnvios;
    }
    
    public static String extraerOrigenDesdeNombre(String nombreArchivo) {
        String nombre = nombreArchivo.replace(".txt", "").replace(".csv", "");
        
        if (nombre.startsWith("_envios_") && nombre.endsWith("_")) {
            String sinPrefijo = nombre.substring(8);  
            String codigo = sinPrefijo.substring(0, sinPrefijo.length() - 1);
            return codigo;
        }
        
        if (nombre.contains("_")) {
            String[] partes = nombre.split("_");
            if (partes[0].equals("envios") && partes.length > 1) {
                return partes[1];  
            }
            return partes[0];  
        }
        
        return nombre;
    }

    public static Envio parsearLineaEnvioConOrigen(String linea, String origen, Aeropuerto aeropuertoOrigen,
        Map<String,Aeropuerto> aeropuertos
    ) {
        try {
            String[] partes = linea.split("-");
            if (partes.length < 7) {
                return null;
            }
            
            int idEnvio = Integer.parseInt(partes[0]);
            String fechaStr = partes[1];
            int hora = Integer.parseInt(partes[2]);
            int minuto = Integer.parseInt(partes[3]);
            String destino = partes[4];
            Aeropuerto aeropuertoDestino = aeropuertos.get(destino);
            int cantidadMaletas = Integer.parseInt(partes[5]);
            
            int anio = Integer.parseInt(fechaStr.substring(0, 4));
            int mes = Integer.parseInt(fechaStr.substring(4, 6));
            int dia = Integer.parseInt(fechaStr.substring(6, 8));
            
            LocalDateTime fechaHora = LocalDateTime.of(anio, mes, dia, hora, minuto);
            if (aeropuertoOrigen != null) {
                fechaHora = fechaHora.plusHours(aeropuertoOrigen.getGmt());
            }
            
            return new Envio(idEnvio, aeropuertoOrigen, aeropuertoDestino, fechaHora, cantidadMaletas);
            
        } catch (Exception e) {
            return null;
        }
    }
}