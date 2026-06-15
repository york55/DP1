import java.util.regex.*;
import java.io.*;
import java.nio.file.*;
import java.math.BigDecimal;

public class TestSeeder {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(
            new FileInputStream("src/main/resources/data/aeropuertos.txt")));
        String line;
        String currentContinent = "Unknown";
        Pattern airportPattern = Pattern.compile("^\\d+\\s+([A-Z]{4})\\s+(.+?)\\s{2,}(.+?)\\s{2,}([a-z]{4})\\s+([\\+\\-]?\\d+)\\s+(\\d+)\\s+Latitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([NS])\\s+Longitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([EW])$");
        int count = 0;
        while ((line = br.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("*") || line.startsWith("PDDS") || line.contains("GMT")) {
                continue;
            }
            if (!line.matches("^\\d+.*")) {
                currentContinent = line.replace(".", "").trim();
                System.out.println("Continent: " + currentContinent);
                continue;
            }
            Matcher m = airportPattern.matcher(line);
            if (m.matches()) {
                count++;
            } else {
                System.out.println("NO MATCH: " + line);
            }
        }
        System.out.println("Total: " + count);
    }
}
