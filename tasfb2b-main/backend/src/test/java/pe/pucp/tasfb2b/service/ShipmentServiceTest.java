package pe.pucp.tasfb2b.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pe.pucp.tasfb2b.domain.Airport;
import pe.pucp.tasfb2b.domain.BaggageBatch;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ShipmentServiceTest {

    private ShipmentService service;

    @BeforeEach
    void setUp() {
        service = new ShipmentService(null, null, null, null, null);
    }

    @Test
    void testDeadlineIsCalculatedCorrectlyIntracontinental() {
        Airport origin = airport("LIM", "Americas");
        Airport dest = airport("GRU", "Americas");

        BaggageBatch batch = new BaggageBatch();
        batch.setOriginAirport(origin);
        batch.setDestinationAirport(dest);
        LocalDateTime availableFrom = LocalDateTime.of(2026, 5, 10, 6, 0);
        batch.setAvailableFrom(availableFrom);

        LocalDateTime deadline = service.computeDeadline(batch,
                LocalDateTime.of(2026, 5, 10, 0, 0));

        assertThat(deadline).isEqualTo(availableFrom.plusDays(1));
    }

    @Test
    void testDeadlineIsCalculatedCorrectlyIntercontinental() {
        Airport origin = airport("LIM", "Americas");
        Airport dest = airport("CDG", "Europe");

        BaggageBatch batch = new BaggageBatch();
        batch.setOriginAirport(origin);
        batch.setDestinationAirport(dest);
        LocalDateTime availableFrom = LocalDateTime.of(2026, 5, 10, 8, 0);
        batch.setAvailableFrom(availableFrom);

        LocalDateTime deadline = service.computeDeadline(batch,
                LocalDateTime.of(2026, 5, 10, 0, 0));

        assertThat(deadline).isEqualTo(availableFrom.plusDays(2));
    }

    private Airport airport(String iata, String continent) {
        Airport a = new Airport();
        a.setIataCode(iata);
        a.setContinent(continent);
        a.setLatitude(BigDecimal.ZERO);
        a.setLongitude(BigDecimal.ZERO);
        return a;
    }
}
