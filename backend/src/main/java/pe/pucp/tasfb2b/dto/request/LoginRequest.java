package pe.pucp.tasfb2b.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class LoginRequest {
    private String username;
    private String password;
}
