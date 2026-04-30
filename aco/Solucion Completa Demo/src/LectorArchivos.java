package src;

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
            // Detectar continente
            if (linea.contains("America del Sur")) { continenteActual = "AMERICA"; continue; }
            if (linea.contains("Europa"))           { continenteActual = "EUROPA";  continue; }
            if (linea.contains("Asia"))             { continenteActual = "ASIA";    continue; }

            // Saltar líneas que no empiezan con dígito
            if (linea.isEmpty() || !Character.isDigit(linea.charAt(0))) continue;

            int idxLat = linea.indexOf("Latitude:");
            if (idxLat != -1) linea = linea.substring(0, idxLat).trim();

            String[] partes = linea.trim().split("\\s+");

            if (partes.length < 4) continue;

            try {
                String codigo   = partes[1];
                int gmt         = Integer.parseInt(partes[partes.length - 2]);
                int capacidad   = Integer.parseInt(partes[partes.length - 1]);
                aeropuertos.put(codigo, new Aeropuerto(id, gmt, "", codigo, continenteActual, capacidad));
                id++;

            } catch (NumberFormatException e) {
                continue;
            }
        }

        return aeropuertos;
    }
    
    public static List<VueloDiario> leerVuelos(String rutaArchivo,Map<String,Aeropuerto> aeropuertos) throws IOException {
        List<VueloDiario> vuelos = new ArrayList<>();
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

                horaSalida = horaSalida.plusHours(aero_origen.getGmt());
                horaLlegada = horaLlegada.plusHours(aero_origen.getGmt());

                vuelos.add(new VueloDiario(id,aero_origen,aero_destino,horaSalida, horaLlegada, capacidad));
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
            String origen = extraerOrigenDesdeNombre(nombreArchivo); //codigo de aeropuerto
            System.out.println("  Procesando: " + nombreArchivo + " (origen: " + origen + ")");
            
            List<String> lineas = Files.readAllLines(archivo.toPath(), StandardCharsets.UTF_8);
            int contador = 0;
            
            for (String linea : lineas) {
                if (linea.trim().isEmpty() || linea.startsWith("#")) continue;
                Aeropuerto aeropuerto = aeropuertos.get(origen);
                Envio envio = parsearLineaEnvioConOrigen(linea, origen, aeropuerto,aeropuertos);
                if (envio != null) {
                    todosEnvios.add(envio);
                    contador++;
                }
            }
            
            System.out.println("    Cargados " + contador + " envios");
        }
        
        return todosEnvios;
    }
    
    public static String extraerOrigenDesdeNombre(String nombreArchivo) {
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

    public static Envio parsearLineaEnvioConOrigen(String linea, String origen, Aeropuerto aeropuertoOrigen,
        Map<String,Aeropuerto> aeropuertos
    ) {
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
            Aeropuerto aeropuertoDestino = aeropuertos.get(destino);
            int cantidadMaletas = Integer.parseInt(partes[5]);
            // partes[6] = id_cliente (se ignora)
            
            // Construir LocalDateTime
            int anio = Integer.parseInt(fechaStr.substring(0, 4));
            int mes = Integer.parseInt(fechaStr.substring(4, 6));
            int dia = Integer.parseInt(fechaStr.substring(6, 8));
            
            LocalDateTime fechaHora = LocalDateTime.of(anio, mes, dia, hora, minuto);
            fechaHora = fechaHora.plusHours(aeropuertoOrigen.getGmt());
            
            return new Envio(idEnvio, aeropuertoOrigen, aeropuertoDestino, fechaHora, cantidadMaletas);
            
        } catch (Exception e) {
            System.err.println("  Error parseando envio: " + linea);
            return null;
        }
    }
}