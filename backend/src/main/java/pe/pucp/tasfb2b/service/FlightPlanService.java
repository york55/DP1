package pe.pucp.tasfb2b.service;

import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.dto.response.FlightPlanResponse;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

@Service
public class FlightPlanService {

    public List<FlightPlanResponse> getFlightPlans() {
        List<FlightPlanResponse> flights = new ArrayList<>();

        try (InputStream is = getClass().getClassLoader().getResourceAsStream("planes_vuelo.txt");
             BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {

            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] parts = line.split("-");
                if (parts.length != 5) continue;

                flights.add(new FlightPlanResponse(
                    parts[0],
                    parts[1],
                    parts[2],
                    parts[3],
                    Integer.parseInt(parts[4])
                ));
            }

        } catch (Exception e) {
            throw new RuntimeException("Error reading planes_vuelo.txt: " + e.getMessage(), e);
        }

        return flights;
    }
}