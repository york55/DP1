package pe.pucp.tasfb2b.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UploadProgressDto {
    private int processed;
    private int total;
    private String status;
    private String message;
    private String aeropuerto;
    private int inserted;

    public UploadProgressDto(int processed, int total, String status, String message) {
        this.processed = processed;
        this.total = total;
        this.status = status;
        this.message = message;
    }

    public UploadProgressDto(int processed, int total, String status, String message, String aeropuerto, int inserted) {
        this(processed, total, status, message);
        this.aeropuerto = aeropuerto;
        this.inserted = inserted;
    }
}
