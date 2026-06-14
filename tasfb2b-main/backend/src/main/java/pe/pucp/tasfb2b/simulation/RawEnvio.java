package pe.pucp.tasfb2b.simulation;

import java.time.LocalDateTime;

public class RawEnvio {

    private final String originIata;
    private final String destinationIata;
    private final LocalDateTime availableFrom;
    private final int quantity;

    public RawEnvio(String originIata, String destinationIata, LocalDateTime availableFrom, int quantity) {
        this.originIata = originIata;
        this.destinationIata = destinationIata;
        this.availableFrom = availableFrom;
        this.quantity = quantity;
    }

    public String getOriginIata()         { return originIata; }
    public String getDestinationIata()    { return destinationIata; }
    public LocalDateTime getAvailableFrom() { return availableFrom; }
    public int getQuantity()              { return quantity; }
}
