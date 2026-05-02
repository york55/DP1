import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Hormigo {
    private ListaVuelosDia lista_vuelos;
    private Map<String,Aeropuerto> aeropuertos;
    private MatrizFeromonas3D fermonas;
    private double costo_final;
    private boolean factible;
    private double alpha;
    private double beta;
    private Envio envio;
    private RutaEnvio ruta;

    public Hormigo(Envio envio,MatrizFeromonas3D fermonas,
        ListaVuelosDia lista_vuelos,Map<String,Aeropuerto> aeropuertos,
        double alpha,double beta){
        
        this.fermonas = fermonas;
        this.envio = envio;
        this.lista_vuelos = lista_vuelos;
        this.aeropuertos = aeropuertos;
        this.alpha = alpha;
        this.beta = beta;
        this.factible = true;
        this.ruta = new RutaEnvio();
    }

    public void construirSolucion(){
        String origen = envio.getOrigen().getCodigo();
        String destino = envio.getDestino().getCodigo();
        boolean mismoContinente = envio.getEsMismoContinente();
        LocalDateTime tiempoInicio = envio.getDiaHoraIngreso();
        LocalDateTime tiempoActual = tiempoInicio;
        ruta.setEnvio(envio);
        Set<String> visitados = new HashSet<>();
        visitados.add(origen);
        //Para cada envio el costo se reinicia
        this.costo_final = 0;
        //Tomar vuelos hasta el destino
        int pasos = 0;
        int maxPasos = mismoContinente ? 4 : 6;
        while(!origen.equals(destino) && factible && pasos < maxPasos){
            //Vuelos que puede tomar
            List<VueloDiario> posibles = obtenerVuelosPosiblesDos(envio,mismoContinente,origen,destino,tiempoActual,tiempoInicio,visitados);
            if(posibles.isEmpty()) { factible=false; break; }
            //Probabilidad de tomar cada uno
            List<Double> probabilidades = obtenerProbabilidades(posibles, tiempoActual);
            //Elejir el vuelo segun fermonas
            VueloDiario vuelo_elegido = seleccionPonderada(posibles,probabilidades);
            //Poner como visitado
            visitados.add(vuelo_elegido.getDestino().getCodigo());
            VueloFecha vf;
            if(vuelo_elegido.getHoraSalida().isBefore(tiempoActual.toLocalTime())){
                vf = lista_vuelos.efectuarEnvioVuelo(
                    vuelo_elegido,
                    tiempoActual.plusDays(1).toLocalDate(),
                    envio
                );
            }else{
                vf = lista_vuelos.efectuarEnvioVuelo(
                    vuelo_elegido,
                    tiempoActual.toLocalDate(),
                    envio
                );
            }
            ruta.agregarVuelo(
                vf
            );
            tiempoActual = vf.getFechaHoraLlegada();
            //Actualizar con la nueva posicion, el aeropuerto destino
            origen = vuelo_elegido.getDestino().getCodigo();
            pasos++;
        }
        boolean llego = origen.equals(destino);
        if(llego){
            double tiempoTotal = Duration.between(
                envio.getDiaHoraIngreso(), tiempoActual
            ).toHours();
            ruta.setTiempoTotal(tiempoTotal);
            this.costo_final = tiempoTotal + pasos * 2; // penalizar escalas
        }else{
            this.costo_final = Double.POSITIVE_INFINITY;
        }
    }
    
    private List<VueloDiario> obtenerVuelosPosiblesDos(Envio envio, boolean mismoContinente, String origen, String destino,
        LocalDateTime tiempoActual, LocalDateTime tiempoInicio, Set<String> visitados) {
        List<VueloDiario> lista = new ArrayList<>();
        List<VueloDiario> vuelos_origen = lista_vuelos.obtenerPorOrigen(origen);
        double plazoMaximo = (mismoContinente) ? 24 : 48;

        for (VueloDiario vuelo : vuelos_origen) {
            String vuelo_destino = vuelo.getDestino().getCodigo();
            // Filtro 1: no revisitar aeropuertos
            if (visitados.contains(vuelo_destino)) continue;
            // Calcular momento de llegada (puede cruzar medianoche)
            LocalDateTime llegada = vuelo.getFechaHoraLlegada(tiempoActual.toLocalDate());
            // Filtro 2: respetar plazo máximo del envio
            double tiempoTotal = Duration.between(tiempoInicio, llegada).toHours();
            if (tiempoTotal > plazoMaximo) continue;
            // Filtro 3: el vuelo tiene espacio para las maletas del envio
            VueloFecha vf = vuelo.getVueloFecha(tiempoActual.toLocalDate());
            int espacioEnVuelo = vf.getCapacidadMaxima() - vf.getTotalMaletas();
            if (espacioEnVuelo < envio.getCantidad_maletas()) continue;
            // Filtro 4: el almacén del aeropuerto destino tiene espacio en el momento de llegada
            AlmacenAeropuerto almacenDestino = lista_vuelos.getAlmacen(vuelo_destino);
            if (almacenDestino != null && 
                    !almacenDestino.hayEspacio(envio.getCantidad_maletas(), llegada)){
                continue;
            }
            lista.add(vuelo);
        }
        return lista;
    }

    private List<Double> obtenerProbabilidades(List<VueloDiario> vuelos, LocalDateTime tiempoActual){
        List<Double> probs = new ArrayList<>();
        double suma = 0;
        for (VueloDiario v : vuelos) {
            int i = aeropuertos.get(v.getOrigen().getCodigo()).getId();
            int j = aeropuertos.get(v.getDestino().getCodigo()).getId();
            int k = aeropuertos.get(envio.getDestino().getCodigo()).getId();
            double tau = fermonas.get(i, j, k); 
            
            // Heurística: duración + espera
            double espera = calcularEsperaHoras(tiempoActual, v);
            double duracion = v.getDuracionHoras();
            double eta = 1.0 / (espera + duracion + 0.0001);
            
            double prob = Math.pow(tau, alpha) * Math.pow(eta, beta);
            probs.add(prob);
            suma += prob;
        }
        // Normalizar
        if (suma > 0) {
            for (int k = 0; k < probs.size(); k++) {
                probs.set(k, probs.get(k) / suma);
            }
        } else if (!probs.isEmpty()) {
            double p = 1.0 / probs.size();
            for (int k = 0; k < probs.size(); k++) {
                probs.set(k, p);
            }
        }
        return probs;
    }

    private double calcularEsperaHoras(LocalDateTime ahora, VueloDiario v) {
        LocalDateTime salida = LocalDateTime.of(ahora.toLocalDate(), v.getHoraSalida());
        if (salida.isBefore(ahora)) {
            salida = salida.plusDays(1);
        }
        long minutos = Duration.between(ahora, salida).toMinutes();
        return Math.max(0, minutos / 60.0);
    }

    private VueloDiario seleccionPonderada(List<VueloDiario> vuelos,List<Double> posibilidades){
        if (vuelos.isEmpty()) return null;
        double random = Math.random();
        double acumulado = 0;
        for (int i = 0; i < vuelos.size(); i++) {
            acumulado += posibilidades.get(i);
            if (random <= acumulado) {
                return vuelos.get(i);
            }
        }
        return vuelos.get(vuelos.size() - 1);
    }
    
    public double getCostoTotal() { return this.costo_final; }
    public boolean getEsFactible(){ return this.factible; }
    public RutaEnvio getRuta() { return this.ruta; }

}
