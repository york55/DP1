public class MatrizFeromonas3D {
    private final double[] tau;        // aplanado: [i][j][k] -> i*n*n + j*n + k
    private final int[]    ultimaIter; // iteración en que se actualizó cada celda
    private final int n;
    private final double tau0;
    private final double tauMin;
    private double rho;
    private int iteracionActual;

    // ─── Constructor normal ───────────────────────────────────────────────────
    public MatrizFeromonas3D(int n, double tau0) {
        this.n    = n;
        this.tau0 = tau0;
        this.tauMin = tau0 * 0.01; // piso: 1% del valor inicial
        this.rho  = 0.0;           // se setea desde ACO antes de usarse
        this.iteracionActual = 0;
        int total = n * n * n;
        this.tau        = new double[total];
        this.ultimaIter = new int[total];
        java.util.Arrays.fill(tau, tau0);
        // ultimaIter ya es 0 por defecto
    }

    // ─── Constructor copia (para clonar Global -> Iteracion) ─────────────────
    public MatrizFeromonas3D(MatrizFeromonas3D otra) {
        this.n               = otra.n;
        this.tau0            = otra.tau0;
        this.tauMin          = otra.tauMin;
        this.rho             = otra.rho;
        this.iteracionActual = otra.iteracionActual;
        this.tau             = otra.tau.clone();        // copia de primitivos: O(n³) pero muy rápido
        this.ultimaIter      = otra.ultimaIter.clone(); // ídem
    }

    // ─── API que ACO necesita setear rho ─────────────────────────────────────
    public void setRho(double rho) {
        this.rho = rho;
    }

    // ─── Avanzar iteración (llamar al INICIO de cada iter del loop ACO) ──────
    public void avanzarIteracion() {
        iteracionActual++;
    }

    // ─── GET: aplica evaporación acumulada lazy ───────────────────────────────
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

    // ─── SET: escribe valor directo ───────────────────────────────────────────
    public void set(int i, int j, int k, double valor) {
        int idx = i * n * n + j * n + k;
        tau[idx] = Math.max(valor, tauMin);
        ultimaIter[idx] = iteracionActual;
    }

    // ─── ADD: reforza feromona (aplica evaporación pendiente primero) ─────────
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

    // ─── EVAPORAR: método legacy, ahora es no-op (la lazy lo reemplaza) ──────
    // Se mantiene para no romper llamadas existentes en código viejo
    public void evaporar(double rho, int jFijo) {
        // No hace nada: la evaporación ocurre lazy en get() y add()
    }

    public int getN() { return n; }
}
/*
public class MatrizFeromonas3D {
    private double[][][] tau;
    private int n;
    private double tau0;
    
    public MatrizFeromonas3D(int n, double tau0) {
        this.n = n;
        this.tau0 = tau0;
        this.tau = new double[n][n][n];
        inicializar();
    }

    public MatrizFeromonas3D(MatrizFeromonas3D otra) {
        this.n = otra.n;
        this.tau0 = otra.tau0;
        this.tau = new double[n][n][n];

        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                this.tau[i][j] = otra.tau[i][j].clone(); // más rápido
            }
        }
    }
    
    private void inicializar() {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                for (int k = 0; k < n; k++) {
                    tau[i][j][k] = tau0;
                }
            }
        }
    }
    
    public double get(int i, int j, int k) {
        return tau[i][j][k];
    }
    
    public void set(int i, int j, int k, double valor) {
        tau[i][j][k] = valor;
    }
    
    public void add(int i, int j, int k, double incremento) {
        tau[i][j][k] += incremento;
    }
    
    public void evaporar(double rho, int jFijo) {
        for (int i = 0; i < n; i++) {
            for (int k = 0; k < n; k++) {
                tau[i][jFijo][k] *= (1 - rho);
            }
        }
    }
    
    public int getN() { return n; }

}
*/