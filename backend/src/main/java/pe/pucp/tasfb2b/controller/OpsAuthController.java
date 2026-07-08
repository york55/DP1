package pe.pucp.tasfb2b.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.pucp.tasfb2b.dto.request.LoginRequest;
import pe.pucp.tasfb2b.dto.response.LoginResponse;
import pe.pucp.tasfb2b.service.OpsAuthService;

@RestController
@RequestMapping("/api/ops/auth")
@RequiredArgsConstructor
public class OpsAuthController {

    private final OpsAuthService authService;

    /**
     * POST /api/ops/auth/login
     * Body: { "username": "20222232", "password": "20222232" }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }
}
