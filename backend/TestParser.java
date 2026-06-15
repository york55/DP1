import java.util.regex.*;
import java.io.*;
import java.nio.file.*;
import java.math.BigDecimal;

public class TestParser {
    public static void main(String[] args) throws Exception {
        String line = "01   SKBO   Bogota              Colombia        bogo    -5     430     Latitude: 04 42' 05\" N   Longitude:  74 08' 49\" W";
        Pattern pattern = Pattern.compile("^\\d+\\s+([A-Z]{4})\\s+(.+?)\\s{2,}(.+?)\\s{2,}([a-z]{4})\\s+([\\+\\-]?\\d+)\\s+(\\d+)\\s+Latitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([NS])\\s+Longitude:\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)\\D+([EW])$");
        Matcher m = pattern.matcher(line);
        if (m.matches()) {
            System.out.println("IATA: " + m.group(1));
            System.out.println("City: " + m.group(2).trim());
            System.out.println("Country: " + m.group(3).trim());
            System.out.println("Capacity: " + m.group(6));
            
            double lat = Double.parseDouble(m.group(7)) + Double.parseDouble(m.group(8))/60.0 + Double.parseDouble(m.group(9))/3600.0;
            if (m.group(10).equals("S")) lat = -lat;
            
            double lon = Double.parseDouble(m.group(11)) + Double.parseDouble(m.group(12))/60.0 + Double.parseDouble(m.group(13))/3600.0;
            if (m.group(14).equals("W")) lon = -lon;
            
            System.out.println("Lat: " + lat);
            System.out.println("Lon: " + lon);
        } else {
            System.out.println("NO MATCH");
        }
    }
}
