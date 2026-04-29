package src;

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

    public MatrizFeromonas3D(int n, double q,double tau0,double rho) {
        this.n    = n;
        this.tau0 = tau0;
        this.tauMin = tau0 * 0.01; // piso: 1% del valor inicial
        this.rho  = rho;           // se setea desde ACO antes de usarse
        this.iteracionActual = 0;
        this.q = q;
        int total = n * n * n;
        this.tau        = new double[total];
        this.ultimaIter = new int[total];
        java.util.Arrays.fill(tau, tau0);
    }

    // ─── Constructor copia
    public MatrizFeromonas3D(MatrizFeromonas3D otra) {
        this.n               = otra.n;
        this.tau0            = otra.tau0;
        this.tauMin          = otra.tauMin;
        this.rho             = otra.rho;
        this.q               = otra.q;
        this.iteracionActual = otra.iteracionActual;
        this.tau             = otra.tau.clone();        // copia de primitivos: O(n³) pero muy rápido
        this.ultimaIter      = otra.ultimaIter.clone(); // ídem
    }

    public void actualizar(List<RutaEnvio> rutas_envios){
        for (RutaEnvio ruta : rutas_envios) {
            double costo = ruta.getTiempoTotal(); // o tu métrica
            if (costo <= 0) continue;
            double delta = q / costo;
            List<VueloFecha> vuelos = ruta.getVuelos();
            for (int i = 0; i < vuelos.size() - 1; i++) {
                VueloFecha v1 = vuelos.get(i);
                VueloFecha v2 = vuelos.get(i + 1);
                int origen  = v1.getVueloBase().getOrigen().getId();
                int inter   = v1.getVueloBase().getDestino().getId();
                int destino = v2.getVueloBase().getDestino().getId();
                add(origen, inter, destino, delta);
            }
        }
    }

    public void actualizarRuta(RutaEnvio ruta){
        double costo = ruta.getTiempoTotal(); // o tu métrica
        if (costo <= 0) return;
        double delta = q / costo;
        List<VueloFecha> vuelos = ruta.getVuelos();
        for (int i = 0; i < vuelos.size() - 1; i++) {
            VueloFecha v1 = vuelos.get(i);
            VueloFecha v2 = vuelos.get(i + 1);
            int origen  = v1.getVueloBase().getOrigen().getId();
            int inter   = v1.getVueloBase().getDestino().getId();
            int destino = v2.getVueloBase().getDestino().getId();
            add(origen, inter, destino, delta);
        }
    }

    public void evaporar(double rho, int jFijo) {
        for (int i = 0; i < n; i++) {
            for (int k = 0; k < n; k++) {
                int idx = i * n * n + jFijo * n + k;

                int delta = iteracionActual - ultimaIter[idx];
                if (delta > 0) {
                    tau[idx] *= Math.pow(1.0 - this.rho, delta);
                }

                tau[idx] *= (1.0 - rho);

                if (tau[idx] < tauMin) tau[idx] = tauMin;

                ultimaIter[idx] = iteracionActual;
            }
        }
    }

    public double get(int i, int j, int k) {
        int idx   = i * n * n + j * n + k;
        int delta = iteracionActual - ultimaIter[idx];
        if (delta > 0) {
            tau[idx] *= Math.pow(1.0 - rho, delta); // (1-rho)^delta en una sola op
            if (tau[idx] < tauMin) tau[idx] = tauMin;
            ultimaIter[idx] = iteracionActual;
        }
        return tau[idx];
    }

    public void set(int i, int j, int k, double valor) {
        int idx = i * n * n + j * n + k;
        tau[idx] = Math.max(valor, tauMin);
        ultimaIter[idx] = iteracionActual;
    }

    public void add(int i, int j, int k, double incremento) {
        int idx   = i * n * n + j * n + k;
        int delta = iteracionActual - ultimaIter[idx];
        if (delta > 0) {
            tau[idx] *= Math.pow(1.0 - rho, delta);
            if (tau[idx] < tauMin) tau[idx] = tauMin;
            ultimaIter[idx] = iteracionActual;
        }
        tau[idx] += incremento;
    }

    public int getN() { return n; }
    
    public void setRho(double rho) { this.rho = rho; }

    public void avanzarIteracion() { iteracionActual++; }
}