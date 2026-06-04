package pe.pucp.tasfb2b.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class EnvioService {

    /**
     * Directorio donde se guardan los archivos de envíos.
     * Configurable vía application.properties: envios.directorio=./envios
     */
    @Value("${envios.directorio:./envios}")
    private String directorioEnvios;

    private static final DateTimeFormatter FECHA_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter HORA_FMT  = DateTimeFormatter.ofPattern("HH-mm");

    /**
     * Registra un nuevo envío en el archivo correspondiente al almacén origen.
     *
     * @param almacenOrigen   Código del almacén origen  (ej. "SKBO")
     * @param almacenDestino  Código del almacén destino (ej. "SEQM")
     * @param cantidadMaletas Cadena de 3 dígitos        (ej. "025")
     * @return La línea completa que se escribió en el archivo.
     */
    public String registrarEnvio(String almacenOrigen, String almacenDestino, String cantidadMaletas)
            throws IOException {

        // Asegurar que el directorio existe
        Path dir = Paths.get(directorioEnvios);
        Files.createDirectories(dir);

        // Archivo destino: _envios_SKBO_.txt
        Path archivo = dir.resolve("_envios_" + almacenOrigen + "_.txt");

        // Calcular el próximo id de envío
        long proximoId = calcularProximoId(archivo);

        // Fecha y hora actuales
        LocalDateTime ahora = LocalDateTime.now();
        String fecha = ahora.format(FECHA_FMT);   // aaaammdd
        String hora  = ahora.format(HORA_FMT);    // hh-mm

        // IdCliente: 7 dígitos, derivado del id de envío (puedes reemplazar con lógica real)
        String idCliente = generarIdCliente(proximoId);

        // Formatear línea: 000000001-20260102-06-30-SEQM-025-0012500
        String linea = String.format("%09d-%s-%s-%s-%s-%s",
                proximoId,
                fecha,
                hora,
                almacenDestino,
                cantidadMaletas,
                idCliente);

        // Escribir al final del archivo (append), con salto de línea
        try (BufferedWriter writer = Files.newBufferedWriter(
                archivo,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND)) {
            writer.write(linea);
            writer.newLine();
        }

        return linea;
    }

    /**
     * Lee el archivo existente y devuelve el id del último registro + 1.
     * Si el archivo no existe o está vacío, retorna 1.
     */
    private long calcularProximoId(Path archivo) throws IOException {
        if (!Files.exists(archivo)) return 1L;

        List<String> lineas = Files.readAllLines(archivo, StandardCharsets.UTF_8);

        // Buscar la última línea no vacía
        for (int i = lineas.size() - 1; i >= 0; i--) {
            String linea = lineas.get(i).trim();
            if (!linea.isEmpty()) {
                // El id es la primera parte antes del primer '-'
                String[] partes = linea.split("-");
                if (partes.length > 0) {
                    try {
                        return Long.parseLong(partes[0]) + 1;
                    } catch (NumberFormatException ignored) {
                        // línea malformada, ignorar
                    }
                }
            }
        }
        return 1L;
    }

    /**
     * Genera el IdCliente de 7 dígitos.
     * Por defecto: simplemente el id de envío como 7 dígitos.
     * Reemplaza esta lógica con la real de tu dominio.
     */
    private String generarIdCliente(long idEnvio) {
        // Ejemplo: id × 500 (igual que en el archivo de muestra: id=1 → 0012500 = 25×500)
        // Ajusta según tu lógica de negocio real
        long idCliente = idEnvio * 500L;
        return String.format("%07d", idCliente);
    }
}
