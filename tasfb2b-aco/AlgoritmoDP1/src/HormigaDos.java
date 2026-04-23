import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.Duration;

public class HormigaDos {
    private Map<String, List<Vuelo>> vuelosPorOrigen;
    private Map<String, Aeropuerto> aeropuertos;
    private MatrizFeromonas3D feromonas;
    private Map<String, Integer> aeropuertoIdx;
    private double alpha;
    private double beta;
    private Map<Integer,Ruta> rutasAsignadas;
    private List<Envio> envios;
    private int fallos;
    private double costoTotal;
    //Los movimientos de maleta en vuelos para esta planifiacion de rutas de los envios
    List<MovimientoCapacidad> movimientos = new ArrayList<>();
    // PROFILING
    private long tConstruirSolucion = 0;
    private long tConstruirRuta = 0;
    private long tVuelosPosibles = 0;
    private long tProbabilidades = 0;
    private long tSeleccion = 0;
    private long tCosto = 0;
    private long tRollback = 0;     
    
    public HormigaDos(List<Envio> envios,Map<String, List<Vuelo>> vuelosPorOrigen, 
                   Map<String, Aeropuerto> aeropuertos,MatrizFeromonas3D feromonas,
                   Map<String, Integer> aeropuertoIdx,
                   double alpha, double beta) {
        this.vuelosPorOrigen = vuelosPorOrigen;
        this.aeropuertos = aeropuertos;
        this.feromonas = feromonas;
        this.aeropuertoIdx = aeropuertoIdx;
        this.alpha = alpha;
        this.beta = beta;
        this.envios = envios;
    }
    
public void construirSolucionCompleta(){
    long t0 = System.nanoTime();

    rutasAsignadas = new HashMap<>();
    fallos = 0;

    double costo = 0; // NUEVO

    for(Envio envio : envios){

        long tRuta = System.nanoTime();

        Ruta ruta = construirRuta(
                envio,
                envio.getOrigen(),
                envio.getDestino(),
                envio.getCantidadMaletas(),
                envio.getDiaHoraIngreso()
        );

        tConstruirRuta += System.nanoTime() - tRuta;

        if(ruta != null && !ruta.isEmpty()){
            ruta.setEnvioAsignado(envio);
            rutasAsignadas.put(envio.getId(),ruta);

            // CALCULAR COSTO AQUÍ (ANTES LO HACÍAS DESPUÉS)
            double tiempoViaje = ruta.getTiempoTotal();
            costo += tiempoViaje;

            String contOrigen = aeropuertos.get(envio.getOrigen()).getContinente();
            String contDestino = aeropuertos.get(envio.getDestino()).getContinente();
            int plazoMax = contOrigen.equals(contDestino) ? 24 : 48;

            if (tiempoViaje > plazoMax) {
                costo += 100;
            }

        }else{
            fallos++;
            costo += 1000; // penalización directa
        }
    }

    this.costoTotal = costo; // YA NO LLAMAS A calcularCostoGlobal

    tConstruirSolucion += System.nanoTime() - t0;
}

    public Ruta construirRuta(Envio envio,String origen,
                              String destino,int cantidadMaletas,
                              LocalDateTime tiempoInicio) {
        Set<String> visitados = new HashSet<>();
        visitados.add(origen);
        String actual = origen;
        //Juntar ambos en localdate
        LocalDateTime tiempoActual = tiempoInicio;
        boolean factible = true;
        Ruta ruta = new Ruta();
        
        while (!actual.equals(destino)  && factible) {

            long t1 = System.nanoTime();
            List<Vuelo> vuelosPosibles = obtenerVuelosPosibles(
                actual, destino, visitados, tiempoActual, tiempoInicio, cantidadMaletas
            );
            tVuelosPosibles += System.nanoTime() - t1;

            if (vuelosPosibles.isEmpty()) {
                factible = false;
                break;
            }

            long t2 = System.nanoTime();
            List<Double> probabilidades = obtenerProbabilidades(
                actual, destino, vuelosPosibles, tiempoActual
            );
            tProbabilidades += System.nanoTime() - t2;

            long t3 = System.nanoTime();
            Vuelo vueloElegido = seleccionarPorRuleta(vuelosPosibles, probabilidades);
            tSeleccion += System.nanoTime() - t3;

            if (vueloElegido == null) {
                factible = false;
                break;
            }
            // Actualizar capacidad para el vuelo en esa fecha
            LocalDate fechaUso = tiempoActual.toLocalDate();
            vueloElegido.usarCapacidadFecha(fechaUso, cantidadMaletas);
            movimientos.add(new MovimientoCapacidad(vueloElegido, fechaUso, cantidadMaletas));
            // Actualizar ruta
            VueloAsignado vuelo = vueloElegido.getVueloAsignado(fechaUso);
            ruta.agregarVuelo(vuelo);
            visitados.add(vueloElegido.getDestino());
            actual = vueloElegido.getDestino();
            //Actualizar la hora y fecha del envio en ese momento, agregando este vuelo
            LocalTime horaLlegada = vueloElegido.getHoraLlegada();
            LocalDate fecha = tiempoActual.toLocalDate();
            // Si llega "antes" que la hora actual → es al día siguiente
            if (horaLlegada.isBefore(tiempoActual.toLocalTime())) {
                fecha = fecha.plusDays(1);
            }
            tiempoActual = LocalDateTime.of(fecha, horaLlegada);
        }
        
        if (!factible || !actual.equals(destino)) {
            factible = false;
        } else {
            //REVISAR FUNCION - MAL PLANTEADA
            double tiempoTotal = Duration.between(tiempoInicio, tiempoActual).toHours();
            ruta.setTiempoTotal(tiempoTotal);
        }
        return ruta;
    }
    
    private List<Vuelo> obtenerVuelosPosibles(String actual, String destino, Set<String> visitados,
                                            LocalDateTime tiempoActual, LocalDateTime tiempoInicio,
                                            int cantidadMaletas) {

        List<Vuelo> posibles = new ArrayList<>();
        List<Vuelo> vuelos = vuelosPorOrigen.getOrDefault(actual, new ArrayList<>());

        for (Vuelo v : vuelos) {

            // 1. No ciclos
            if (visitados.contains(v.getDestino())) continue;

            // 2. Construir salida real del vuelo (puede ser hoy o mañana)
            LocalDateTime salidaVuelo = LocalDateTime.of(
                    tiempoActual.toLocalDate(),
                    v.getHoraSalida()
            );

            if (v.getHoraSalida().isBefore(tiempoActual.toLocalTime())) {
                salidaVuelo = salidaVuelo.plusDays(1);
            }

            // 3. Construir llegada real
            LocalDateTime llegadaVuelo = LocalDateTime.of(
                    salidaVuelo.toLocalDate(),
                    v.getHoraLlegada()
            );

            // Si llega "antes" que sale → cruza medianoche
            if (v.getHoraLlegada().isBefore(v.getHoraSalida())) {
                llegadaVuelo = llegadaVuelo.plusDays(1);
            }

            // 4. Capacidad en la fecha REAL de salida
            LocalDate fechaSalida = salidaVuelo.toLocalDate();
            if (v.getCapacidadActualFecha(fechaSalida) < cantidadMaletas) continue;

            // 5. Restricción GLOBAL de tiempo del envío
            String continenteOrigen = aeropuertos.get(actual).getContinente();
            String continenteFinal = aeropuertos.get(destino).getContinente();

            int plazoMaxHoras = continenteOrigen.equals(continenteFinal) ? 24 : 48;

            long horasTotales = Duration.between(tiempoInicio, llegadaVuelo).toHours();

            if (horasTotales > plazoMaxHoras) continue;

            // válido
            posibles.add(v);
        }

        return posibles;
    }
        
    private List<Double> obtenerProbabilidades(String actual, String destino,List<Vuelo> vuelosPosibles, 
                                                LocalDateTime tiempoActual) {
        List<Double> probs = new ArrayList<>();
        double suma = 0;
        int i = aeropuertoIdx.get(actual);
        int destinoIdx = aeropuertoIdx.get(destino);
        
        for (Vuelo v : vuelosPosibles) {
            int k = aeropuertoIdx.get(v.getDestino());
            double tau = feromonas.get(i, destinoIdx, k);
            
            // Heurística: inversa del tiempo de espera + duración
            double espera = calcularDiferenciaHoras(tiempoActual.toLocalTime(), v.getHoraSalida());
            double duracion = v.getDuracionHoras();
            double eta = 1.0 / (espera + duracion + 1.0);
            
            // Bonus si llegamos directamente al destino
            if (v.getDestino().equals(destino)) {
                eta *= 10.0;
            }
            
            double prob = Math.pow(tau, alpha) * Math.pow(eta, beta);
            probs.add(prob);
            suma += prob;
        }
        
        // Normalizar
        if (suma > 0) {
            for (int j = 0; j < probs.size(); j++) {
                probs.set(j, probs.get(j) / suma);
            }
        }
        return probs;
    }
    
    // rollback
    public void rollback() {
        for (MovimientoCapacidad mov : movimientos) {
            mov.getVuelo().liberarCapacidadFecha(mov.getFecha(), mov.getCantidad());
        }
        movimientos.clear();
    }

    private Vuelo seleccionarPorRuleta(List<Vuelo> vuelos, List<Double> probabilidades) {
        if (vuelos.isEmpty()) return null;
        
        double random = Math.random();
        double acumulado = 0;
        
        for (int i = 0; i < vuelos.size(); i++) {
            acumulado += probabilidades.get(i);
            if (random <= acumulado) {
                return vuelos.get(i);
            }
        }
        return vuelos.get(vuelos.size() - 1);
    }
    
    private double calcularDiferenciaHoras(LocalTime t1, LocalTime t2) {
        int minutos1 = t1.getHour() * 60 + t1.getMinute();
        int minutos2 = t2.getHour() * 60 + t2.getMinute();
        int diff = minutos2 - minutos1;
        if (diff < 0) diff += 24 * 60;
        return diff / 60.0;
    }
    
    public Map<Integer, Ruta> getRutasAsignadas() { return rutasAsignadas; }
    
    public int getFallos() { return fallos; }
        
    public double getCostoTotal() { return costoTotal;}

    public List<MovimientoCapacidad> getMovimientos() {
        return new ArrayList<>(this.movimientos);
    }
    
    public void imprimirProfilingHormiga() {

        long total = tConstruirSolucion;

        if (total == 0) return;

        //System.out.println("\n--- Profiling Hormiga ---");

        imprimir("Construir solución", tConstruirSolucion, total);
        imprimir("Construir ruta", tConstruirRuta, total);
        imprimir("Obtener vuelos", tVuelosPosibles, total);
        imprimir("Probabilidades", tProbabilidades, total);
        imprimir("Selección ruleta", tSeleccion, total);
        imprimir("Costo global", tCosto, total);
        imprimir("Rollback", tRollback, total);
    }

    private void imprimir(String nombre, long tiempoNano, long totalNano) {
        //double ms = tiempoNano / 1_000_000.0;
        //double totalMs = totalNano / 1_000_000.0;
        //double porcentaje = (double) tiempoNano * 100.0 / totalNano;

        //System.out.printf("%-25s: %10.3f ms (%6.2f%%)\n", nombre, ms, porcentaje);
    }

}