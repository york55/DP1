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

    public void actualizarRuta(RutaEnvio ruta) {
        double costo = ruta.getTiempoTotal();
        if (costo <= 0) return;
        double delta = q / costo;
        List<VueloFecha> vuelos = ruta.getVuelos();
        int size = vuelos.size();
        // Caso: un solo vuelo → tripla con origen, destino, destino
        if (size == 1) {
            VueloFecha v = vuelos.get(0);
            int origen  = v.getVueloBase().getOrigen().getId();
            int destino = v.getVueloBase().getDestino().getId();
            add(origen, destino, destino, delta); // o maneja aparte si prefieres
            return;
        }
        // Caso general: ventana deslizante de 3 nodos consecutivos
        for (int i = 0; i < size - 1; i++) {
            VueloFecha vActual = vuelos.get(i);
            VueloFecha vSig    = vuelos.get(i + 1);
            int origen  = vActual.getVueloBase().getOrigen().getId();
            int inter   = vActual.getVueloBase().getDestino().getId();
            // inter == vSig.getOrigen(), son el mismo aeropuerto
            int destino = vSig.getVueloBase().getDestino().getId();
            add(origen, inter, destino, delta);
        }
    }

    /*public void evaporar(int jFijo) { // elimina el parámetro rho redundante
        iteracionActual++;             // avanza la iteración aquí, no externamente
        for (int i = 0; i < n; i++) {
            for (int k = 0; k < n; k++) {
                int idx = i * n * n + jFijo * n + k;
                int delta = iteracionActual - ultimaIter[idx];
                if (delta > 0) {
                    tau[idx] *= Math.pow(1.0 - rho, delta);
                    if (tau[idx] < tauMin) tau[idx] = tauMin;
                    ultimaIter[idx] = iteracionActual;
                }
            }
        }
    }*/

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

}