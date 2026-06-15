package pe.pucp.tasfb2b.domain;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Getter
@Setter
@NoArgsConstructor
public class ActiveFlight {
    private String origin;
    private String destination;
    private LocalTime departureLocal;
    private LocalTime arrivalLocal;
    private int capacity;
    private boolean cancelled;
    private LocalTime cancelledUntil;

    public String getFlightKey() {
        return origin + "-" + destination + "-" +
               departureLocal.toString().substring(0, 5);
    }
}