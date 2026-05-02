import java.util.List;

public class MatrizFeromonas3D {
    private final double[] tau;        // aplanado: [i][j][k] -> i*n*n + j*n + k
    private final int[]    ultimaIter; // iteración en que se actualizó cada celda
    private final int n;
    private final double tau0;
    private final double tauMin;
    private final double q;
    private double rho;
    private int iteracionActual;

    public MatrizFeromonas3D(int n, double q, double tau0, double rho) {
        this.n    = n;
        this.tau0 = tau0;
        this.tauMin = tau0 * 0.01; // piso: 1% del valor inicial
        this.rho  = rho;           
        this.iteracionActual = 0;
        this.q = q;
        int total = n * n * n;
        this.tau        = new double[total];
        this.ultimaIter = new int[total];
        java.util.Arrays.fill(tau, tau0);
    }

    public MatrizFeromonas3D(MatrizFeromonas3D otra) {
        this.n               = otra.n;
        this.tau0            = otra.tau0;
        this.tauMin          = otra.tauMin;
        this.rho             = otra.rho;
        this.q               = otra.q;
        this.iteracionActual = otra.iteracionActual;
        this.tau             = otra.tau.clone();        
        this.ultimaIter      = otra.ultimaIter.clone(); 
    }

    public void actualizarRuta(RutaEnvio ruta) {
        double costo = ruta.getTiempoTotal();
        if (costo <= 0) return;
        double delta = q / costo;
        List<VueloFecha> vuelos = ruta.getVuelos();
        int finalDestinoId = ruta.getEnvio().getDestino().getId();
        
        for (VueloFecha v : vuelos) {
            int origenId = v.getVueloBase().getOrigen().getId();
            int nextId = v.getVueloBase().getDestino().getId();
            add(origenId, nextId, finalDestinoId, delta);
        }
    }

    public void avanzarIteracion() {
        iteracionActual++;
    }

    public double get(int i, int j, int k) {
        int idx   = i * n * n + j * n + k;
        if (idx < 0 || idx >= tau.length) return tau0;
        int delta = iteracionActual - ultimaIter[idx];
        if (delta > 0) {
            tau[idx] *= Math.pow(1.0 - rho, delta); 
            if (tau[idx] < tauMin) tau[idx] = tauMin;
            ultimaIter[idx] = iteracionActual;
        }
        return tau[idx];
    }

    public void add(int i, int j, int k, double incremento) {
        int idx   = i * n * n + j * n + k;
        if (idx < 0 || idx >= tau.length) return;
        int delta = iteracionActual - ultimaIter[idx];
        if (delta > 0) {
            tau[idx] *= Math.pow(1.0 - rho, delta);
            if (tau[idx] < tauMin) tau[idx] = tauMin;
            ultimaIter[idx] = iteracionActual;
        }
        tau[idx] += incremento;
    }
    
    public int getN() { return n; }
}