package pe.pucp.tasfb2b.exception;

public class SimulationNotFoundException extends RuntimeException {

    public SimulationNotFoundException(Long id) {
        super("Simulación no encontrada con id: " + id);
    }
}
