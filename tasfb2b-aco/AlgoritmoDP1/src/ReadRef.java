import java.nio.file.*;
import java.util.List;
import java.nio.charset.StandardCharsets;

public class ReadRef {
    public static void main(String[] args) throws Exception {
        Path p = Paths.get("d:/Marcelo/UniversityProjects/DP1/aco/Solucion Completa Demo/src/datos/aeropuertos.txt");
        List<String> lines = Files.readAllLines(p, StandardCharsets.ISO_8859_1);
        for (int i = 0; i < Math.min(20, lines.size()); i++) {
            System.out.println(lines.get(i).replace("\0", ""));
        }
    }
}
