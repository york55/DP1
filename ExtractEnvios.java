import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

import java.util.concurrent.atomic.AtomicInteger;

public class ExtractEnvios {
    public static void main(String[] args) throws Exception {
        String dataDir = "tasfb2b-alns/datos/_envios_preliminar-20260416T023321Z-3-001/_envios_preliminar";
        String targetDateStr = "20270108";
        String outputFile = "tasfb2b-alns/docs/sample_data/day1/envios.csv";

        DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);
        
        AtomicInteger count = new AtomicInteger(0);
        AtomicInteger totalBags = new AtomicInteger(0);
        
        try (PrintWriter out = new PrintWriter(new FileWriter(outputFile))) {
            out.println("idEnvio,iataOrigen,iataDestino,tipoPaquete,cantidadMaletas,horaDisponibilidadUtc");
            
            Files.list(Paths.get(dataDir))
                .filter(Files::isRegularFile)
                .forEach(path -> {
                    try (BufferedReader br = new BufferedReader(new FileReader(path.toFile()))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            if (line.trim().isEmpty()) continue;
                            String[] parts = line.split("-");
                            if (parts.length < 6) continue;
                            
                            String idEnvio = parts[0];
                            String fecha = parts[1]; // yyyyMMdd
                            if (fecha.equals(targetDateStr)) {
                                String hora = parts[2];
                                String minuto = parts[3];
                                String iataDestino = parts[4];
                                String cantidadMaletasStr = parts[5].replace(".txt", "");
                                int cantidad = Integer.parseInt(cantidadMaletasStr);
                                
                                String tipoPaquete = "NORMAL";
                                
                                String iataOrigen = path.getFileName().toString()
                                        .replace("_envios_", "")
                                        .replace("_.txt", "");

                                // Format 20270108 to 2027-01-08
                                String formattedDate = fecha.substring(0,4) + "-" + fecha.substring(4,6) + "-" + fecha.substring(6,8);
                                String isoTime = formattedDate + "T" + hora + ":" + minuto + ":00.000Z";
                                
                                out.println(idEnvio + "," + iataOrigen + "," + iataDestino + "," + tipoPaquete + "," + cantidad + "," + isoTime);
                                count.incrementAndGet();
                                totalBags.addAndGet(cantidad);
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
        }
        System.out.println("Extracted " + count.get() + " shipments with a total of " + totalBags.get() + " bags into " + outputFile);
    }
}
