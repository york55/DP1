package pe.pucp.tasfb2b.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
public class SimUploadService {

    @Value("${tasf.uploads.dir:uploads}")
    private String uploadsDir;

    private Path uploadsPath;

    @PostConstruct
    public void init() {
        uploadsPath = Paths.get(uploadsDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadsPath);
            log.info("Carpeta de uploads lista: {}", uploadsPath);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo crear la carpeta de uploads: " + uploadsPath, e);
        }
    }

    public void guardar(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Nombre de archivo inválido");
        }
        Path destino = uploadsPath.resolve(filename).normalize();
        // Evitar path traversal
        if (!destino.startsWith(uploadsPath)) {
            throw new SecurityException("Ruta de archivo inválida");
        }
        Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
        log.info("Archivo guardado: {}", filename);
    }

    public List<String> listar() throws IOException {
        try (Stream<Path> paths = Files.list(uploadsPath)) {
            return paths
                    .filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .map(p -> p.getFileName().toString())
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    public void eliminar(String filename) throws IOException {
        Path target = uploadsPath.resolve(filename).normalize();
        if (!target.startsWith(uploadsPath)) {
            throw new SecurityException("Ruta de archivo inválida");
        }
        boolean deleted = Files.deleteIfExists(target);
        if (deleted) {
            log.info("Archivo eliminado: {}", filename);
        } else {
            log.warn("Archivo no encontrado para eliminar: {}", filename);
        }
    }
}
