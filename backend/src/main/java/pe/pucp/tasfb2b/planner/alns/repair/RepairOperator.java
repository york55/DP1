package pe.pucp.tasfb2b.planner.alns.repair;

import pe.pucp.tasfb2b.domain.BaggageBatch;
import pe.pucp.tasfb2b.domain.Flight;
import pe.pucp.tasfb2b.planner.alns.AlnsSolution;

import java.util.List;
import java.util.Random;

public interface RepairOperator {

    void repair(AlnsSolution solution, List<BaggageBatch> allBatches,
                List<Flight> availableFlights, int kRegret, Random rng);

    /**
     * Pase determinístico de rescate: intenta re-acomodar los lotes que quedaron tardíos
     * o sin asignar, reubicando ("eyectando") a los lotes que bloquean sus rutas puntuales
     * hacia rutas puntuales alternativas propias. Retorna cuántos lotes se rescataron.
     * Implementación por defecto: no hace nada.
     */
    default int rescue(AlnsSolution solution) {
        return 0;
    }

    String name();
}
