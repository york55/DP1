
import java.util.*;

public class ACO_Traslados {
    private int PENALIZACION = 1000;
    private int numIteraciones;
    private int numHormigas;
    private double alpha;
    private double beta;
    private double rho;
    private double Q;
    private MatrizFeromonas3D feromonasGlobal;
    private MatrizFeromonas3D feromonasIteracion;
    private Map<String, List<Vuelo>> vuelosPorOrigen;
    private Map<String, Aeropuerto> aeropuertos;
    private Map<String, Integer> aeropuertoIdx;
    private List<Aeropuerto> listaAeropuertos;
    private double mejorCostoGlobal;
    //private Map<String, List<Vuelo>> vuelosDisponibles; // capacidades actualizadas por mejores rutas
    private Map<Integer,Ruta> mejorSolucionGlobal;
    

    public ACO_Traslados(int numIteraciones, int numHormigas, int maxPasos,
                         double alpha, double beta, double rho, double Q, double tau0) {
        this.numIteraciones = numIteraciones;
        this.numHormigas = numHormigas;
        this.alpha = alpha;
        this.beta = beta;
        this.rho = rho;
        this.Q = Q;
        this.mejorCostoGlobal = Double.POSITIVE_INFINITY;
    }
    
    public void inicializar(List<Aeropuerto> aeropuertos, 
                            List<Vuelo> vuelos,
                            MatrizFeromonas3D fermonas) {
        this.listaAeropuertos = aeropuertos;
        this.aeropuertos = new HashMap<>(); //poner todos aeropuertos y obtener con getIndex?
        this.aeropuertoIdx = new HashMap<>();
        for (int i = 0; i < aeropuertos.size(); i++) {
            Aeropuerto ap = aeropuertos.get(i);
            this.aeropuertos.put(ap.getCodigo(), ap);
            this.aeropuertoIdx.put(ap.getCodigo(), i);
        }
        //vuelos global
        this.vuelosPorOrigen = new HashMap<>();
        for (Vuelo v : vuelos) {
            vuelosPorOrigen.computeIfAbsent(v.getOrigen(), k -> new ArrayList<>()).add(v);
        }
        //fermonas global
        this.feromonasGlobal = fermonas;
    }

    public SolucionLoteACO ejecutarLote(List<Envio> envios) {
        long tInicio = System.currentTimeMillis();
        mejorSolucionGlobal = new HashMap<>();
        double mejorCostoGlobal = Double.POSITIVE_INFINITY;
        List<MovimientoCapacidad> mejoresMovimientos = new ArrayList<>();

        // Inicializar mapa de resultados con null para asegurar que todos los IDs existan
        for (Envio e : envios) {
            mejorSolucionGlobal.put(e.getId(), null);
        }

        feromonasIteracion = new MatrizFeromonas3D(feromonasGlobal);

        for (int iter = 1; iter <= numIteraciones; iter++) {
            // ... (resto de la lógica de hormigas igual a tu código original)
            List<Map<Integer, Ruta>> solucionesIteracion = new ArrayList<>();
            List<Double> costosIteracion = new ArrayList<>();
            for (int h = 0; h < numHormigas; h++) {
                HormigaDos hormiga = new HormigaDos(
                    envios,
                    vuelosPorOrigen,
                    aeropuertos,
                    feromonasIteracion,
                    aeropuertoIdx,
                    alpha, beta
                );
                hormiga.construirSolucionCompleta();
                
                double costoActual = hormiga.getCostoTotal() + (hormiga.getFallos() * PENALIZACION);
                
                if (costoActual < mejorCostoGlobal) {
                    mejorCostoGlobal = costoActual;
                    // Guardamos la mejor solución de esta iteración
                    mejorSolucionGlobal = deepCopyRutas(hormiga.getRutasAsignadas());
                    mejoresMovimientos = hormiga.getMovimientos();
                }
                hormiga.rollback();
            }
            // ... (actualización de feromonas de iteración)
            if (!solucionesIteracion.isEmpty()) {
                actualizarFeromonasIteracion(solucionesIteracion, costosIteracion, envios);
            }
        }

        // 1. Aplicar cambios definitivos en la capacidad de los vuelos
        for (MovimientoCapacidad mov : mejoresMovimientos) {
            mov.getVuelo().usarCapacidadFecha(mov.getFecha(), mov.getCantidad());
        }

        // 2. Actualizar feromonas globales
        actualizarFeromonasGlobal(mejorSolucionGlobal);

        long tFin = System.currentTimeMillis();

        // 3. Retornar el objeto de estado completo
        return new SolucionLoteACO(mejorSolucionGlobal, mejorCostoGlobal, (tFin - tInicio));
    }

    public Map<Integer, Ruta> ejecutar(List<Envio> envios){

        mejorSolucionGlobal = new HashMap<>();
        double mejorCostoGlobal = Double.POSITIVE_INFINITY;
        List<MovimientoCapacidad> movimientos = new ArrayList<>();
        feromonasIteracion = new MatrizFeromonas3D(feromonasGlobal);

        for (int iter = 1; iter <= numIteraciones; iter++) {
            List<Map<Integer, Ruta>> solucionesIteracion = new ArrayList<>();
            List<Double> costosIteracion = new ArrayList<>();


            for (int h = 0; h < numHormigas; h++) {
                HormigaDos hormiga = new HormigaDos(
                    envios,
                    vuelosPorOrigen,
                    aeropuertos,
                    feromonasIteracion,
                    aeropuertoIdx,
                    alpha, beta
                );

                hormiga.construirSolucionCompleta();

                double costo = hormiga.getCostoTotal() + (hormiga.getFallos() * PENALIZACION);

                solucionesIteracion.add(hormiga.getRutasAsignadas());
                costosIteracion.add(costo);

                if (costo < mejorCostoGlobal) {
                    mejorCostoGlobal = costo;
                    mejorSolucionGlobal = deepCopyRutas(hormiga.getRutasAsignadas());
                    movimientos = hormiga.getMovimientos();
                }

                hormiga.rollback();

            }


            if (!solucionesIteracion.isEmpty()) {
                actualizarFeromonasIteracion(solucionesIteracion, costosIteracion, envios);
            }
        }

        for (MovimientoCapacidad mov : movimientos) {
            mov.getVuelo().usarCapacidadFecha(mov.getFecha(), mov.getCantidad());
        }

        actualizarFeromonasGlobal(mejorSolucionGlobal);


        // =============================
        // 📊 RESULTADOS
        // =============================


        /*System.out.println("\n===== PROFILING =====");
        //System.out.println("Tiempo total: " + totalMs + " ms");

        imprimir("Construcción solución", tConstruccionTotal, totalMs);
        imprimir("Cálculo costo", tCostoTotal, totalMs);
        imprimir("Rollback", tRollbackTotal, totalMs);
        imprimir("Loop hormigas TOTAL", tHormigasTotal, totalMs);
        imprimir("Feromonas iteración", tFeromonasIterTotal, totalMs);
        imprimir("Actualizar movimientos", tMovimientosTotal, totalMs);
        imprimir("Feromonas global", tFeromonasGlobalTotal, totalMs);
        */
        return mejorSolucionGlobal;
    }

    private void actualizarFeromonasGlobal(Map<Integer,Ruta> solucion){
        
        // evaporacion suave
        for (int i = 0; i < listaAeropuertos.size(); i++) {
            for (int j = 0; j < listaAeropuertos.size(); j++) {
                for (int k = 0; k < listaAeropuertos.size(); k++) {
                    double valor = feromonasGlobal.get(i, j, k);
                    feromonasGlobal.set(i, j, k, valor * (1 - rho * 0.5));
                }
            }
        }

        double peso = Q / mejorCostoGlobal;

        for (Ruta ruta : solucion.values()) {
            if (ruta == null || ruta.isEmpty()) continue;

            int j = aeropuertoIdx.get(
                ruta.getEnvioAsignado().getDestino()
            );

            for (VueloAsignado v : ruta.getVuelos()) {
                int i = aeropuertoIdx.get(v.getOrigen());
                int k = aeropuertoIdx.get(v.getDestino());

                feromonasGlobal.add(i, j, k, peso);
            }
        }
    }

    private void actualizarFeromonasIteracion(List<Map<Integer, Ruta>> soluciones,
                                                List<Double> costos,
                                                List<Envio> envios) {
        int n = listaAeropuertos.size();
        
        // ============================================
        // 7.1 EVAPORACIÓN (para TODOS los j)
        // ============================================
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                for (int k = 0; k < n; k++) {
                    double valor = feromonasIteracion.get(i, j, k);
                    feromonasIteracion.set(i, j, k, valor * (1 - rho));
                }
            }
        }
        
        if (soluciones.isEmpty()) return;
        
        // ============================================
        // 7.2 ORDENAR SOLUCIONES POR COSTO (menor a mayor)
        // ============================================
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < soluciones.size(); i++) indices.add(i);
        indices.sort((a, b) -> Double.compare(costos.get(a), costos.get(b)));
        
        // ============================================
        // 7.3 REFORZAMIENTO (top 30%)
        // ============================================
        int topK = Math.max(1, (int) (numHormigas * 0.3));
        topK = Math.min(topK, soluciones.size());
        
        // Crear mapa rápido id_envio -> Envio
        Map<Integer, Envio> envioPorId = new HashMap<>();
        for (Envio e : envios) {
            envioPorId.put(e.getId(), e);
        }
        
        for (int idx = 0; idx < topK; idx++) {
            int solIdx = indices.get(idx);
            Map<Integer, Ruta> solucion = soluciones.get(solIdx);
            double costo = costos.get(solIdx);
            double peso = Q / costo;
            
            // Por cada envío en esta solución
            for (Map.Entry<Integer, Ruta> entry : solucion.entrySet()) {
                int idEnvio = entry.getKey();
                Ruta ruta = entry.getValue();
                Envio envio = envioPorId.get(idEnvio);
                
                if (envio == null || ruta == null || ruta.isEmpty()) continue;
                
                int j = aeropuertoIdx.get(envio.getDestino());  // destino final del envío
                
                // Por cada vuelo en la ruta
                for (VueloAsignado v : ruta.getVuelos()) {
                    int i = aeropuertoIdx.get(v.getOrigen());
                    int k = aeropuertoIdx.get(v.getDestino());
                    feromonasIteracion.add(i, j, k, peso);
                }
            }
        }
        
    }

    private Map<Integer, Ruta> deepCopyRutas(Map<Integer, Ruta> original) {
        Map<Integer, Ruta> copia = new HashMap<>();

        for (Map.Entry<Integer, Ruta> entry : original.entrySet()) {
            Integer key = entry.getKey();
            Ruta rutaOriginal = entry.getValue();

            if (rutaOriginal != null) {
                copia.put(key, new Ruta(rutaOriginal)); // constructor copia
            } else {
                copia.put(key, null);
            }
        }

        return copia;
    }

    public double getMejorCostoGlobal() { return mejorCostoGlobal; }
        
}
