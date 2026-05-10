package pe.pucp.tasfb2b.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UploadProgressDto {
    private int processed;
    private int total;
    private String status;
    private String message;
}
