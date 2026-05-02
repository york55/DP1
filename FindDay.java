import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;

public class FindDay {
    public static void main(String[] args) throws Exception {
        File dir = new File("d:\\Marcelo\\UniversityProjects\\DP1\\tasfb2b-alns\\datos\\_envios_preliminar-20260416T023321Z-3-001\\_envios_preliminar");
        File[] files = dir.listFiles((d, name) -> name.endsWith(".txt"));
        Map<String, Integer> counts = new HashMap<>();
        
        for (File f : files) {
            try (BufferedReader br = new BufferedReader(new FileReader(f))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.trim().isEmpty() || line.startsWith("#")) continue;
                    String[] parts = line.split("-");
                    if (parts.length >= 6) {
                        String date = parts[1];
                        int qty = Integer.parseInt(parts[5]);
                        counts.put(date, counts.getOrDefault(date, 0) + qty);
                    }
                }
            }
        }
        
        counts.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> {
                if (e.getValue() >= 10000) {
                    System.out.println(e.getKey() + ": " + e.getValue());
                }
            });
    }
}
