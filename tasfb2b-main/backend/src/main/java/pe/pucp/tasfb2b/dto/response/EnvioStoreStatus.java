package pe.pucp.tasfb2b.dto.response;

import java.time.LocalDate;

public class EnvioStoreStatus {

    private final boolean loaded;
    private final int totalCount;
    private final LocalDate minDate;
    private final LocalDate maxDate;

    public EnvioStoreStatus(boolean loaded, int totalCount, LocalDate minDate, LocalDate maxDate) {
        this.loaded = loaded;
        this.totalCount = totalCount;
        this.minDate = minDate;
        this.maxDate = maxDate;
    }

    public boolean isLoaded()     { return loaded; }
    public int getTotalCount()    { return totalCount; }
    public LocalDate getMinDate() { return minDate; }
    public LocalDate getMaxDate() { return maxDate; }
}
