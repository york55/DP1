package pe.pucp.tasfb2b.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/files")
public class FileUploadController {

    @Value("${uploads.dir:uploads}")
    private String uploadsDir;

    private Path uploadsPath() {
        return Paths.get(uploadsDir).toAbsolutePath().normalize();
    }

    @GetMapping
    public ResponseEntity<List<String>> listFiles() throws IOException {
        Path dir = uploadsPath();
        Files.createDirectories(dir);
        List<String> names = Files.list(dir)
                .filter(p -> p.toString().endsWith(".txt"))
                .map(p -> p.getFileName().toString())
                .sorted()
                .collect(Collectors.toList());
        return ResponseEntity.ok(names);
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = Paths.get(file.getOriginalFilename()).getFileName().toString();
        if (!filename.endsWith(".txt")) return ResponseEntity.badRequest().body("Solo .txt");
        Path dest = uploadsPath().resolve(filename);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
        return ResponseEntity.ok(filename);
    }

    @DeleteMapping("/{filename}")
    public ResponseEntity<Void> deleteFile(@PathVariable String filename) throws IOException {
        if (!filename.endsWith(".txt")) return ResponseEntity.badRequest().build();
        Path target = uploadsPath().resolve(filename).normalize();
        if (!target.startsWith(uploadsPath())) return ResponseEntity.badRequest().build(); // path traversal guard
        Files.deleteIfExists(target);
        return ResponseEntity.noContent().build();
    }
}