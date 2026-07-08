package pe.pucp.tasfb2b.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import pe.pucp.tasfb2b.domain.OpsAirport;
import pe.pucp.tasfb2b.domain.OpsUser;
import pe.pucp.tasfb2b.dto.request.LoginRequest;
import pe.pucp.tasfb2b.dto.response.LoginResponse;
import pe.pucp.tasfb2b.repository.OpsAirportRepository;
import pe.pucp.tasfb2b.repository.OpsUserRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpsAuthService {

    private final OpsUserRepository userRepo;
    private final OpsAirportRepository airportRepo;

    public LoginResponse login(LoginRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank()
                || req.getPassword() == null || req.getPassword().isBlank()) {
            throw new IllegalArgumentException("Usuario y contraseña son obligatorios.");
        }

        OpsUser user = userRepo.findByUsername(req.getUsername().trim())
            .orElseThrow(() -> new IllegalArgumentException("Usuario o contraseña incorrectos."));

        if (!user.getPassword().equals(req.getPassword())) {
            throw new IllegalArgumentException("Usuario o contraseña incorrectos.");
        }

        OpsAirport airport = airportRepo.findByIataCode(user.getAirportIata()).orElse(null);

        log.info("Login OPS exitoso: {} ({})", user.getUsername(), user.getAirportIata());

        return new LoginResponse(
            user.getId(),
            user.getFullName(),
            user.getUsername(),
            user.getAirportIata(),
            airport != null ? airport.getName() : null,
            airport != null ? airport.getCountry() : null,
            airport != null ? airport.getGmtOffset() : null
        );
    }
}