package pe.pucp.tasfb2b.service;

import org.springframework.stereotype.Component;
import pe.pucp.tasfb2b.domain.ActiveFlight;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class FlightPlanLoader {

    public List<ActiveFlight> load() {
        List<ActiveFlight> flights = new ArrayList<>();

        try (InputStream is = getClass().getClassLoader().getResourceAsStream("planes_vuelo.txt");
             BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {

            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] parts = line.split("-");
                if (parts.length != 5) continue;

                ActiveFlight f = new ActiveFlight();
                f.setOrigin(parts[0]);
                f.setDestination(parts[1]);
                f.setDepartureLocal(LocalTime.parse(parts[2]));
                f.setArrivalLocal(LocalTime.parse(parts[3]));
                f.setCapacity(Integer.parseInt(parts[4]));
                f.setCancelled(false);
                flights.add(f);
            }

        } catch (Exception e) {
            throw new RuntimeException("Error cargando planes_vuelo.txt: " + e.getMessage(), e);
        }

        return flights;
    }
}