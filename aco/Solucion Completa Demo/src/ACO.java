package src;

import java.util.List;
import java.util.Map;

public class ACO {
    private int nro_iteraciones;
    private int nro_hormigas;
    private double alpha;
    private double beta;
    private Map<String,Aeropuerto> aeropuertos;
    private ListaVuelosDia vuelos;
    private MatrizFeromonas3D fermonas;

    public ACO(int nro_iteraciones,int nro_hormigas,double alpha,double beta,
        double rho, double q,double tau0,Map<String,Aeropuerto> aeropuertos,
        List<VueloDiario> vuelos){
        
        this.nro_hormigas = nro_hormigas;
        this.nro_iteraciones = nro_iteraciones;
        this.alpha = alpha;
        this.beta = beta;
        this.aeropuertos = aeropuertos;
        this.vuelos = new ListaVuelosDia(vuelos,aeropuertos);
        this.fermonas = new MatrizFeromonas3D(aeropuertos.size(),q,tau0,rho);
    }

    public RutaEnvio ejecutar(Envio envio){
        RutaEnvio solucion_global = null;
        double mejor_costo_global = Double.POSITIVE_INFINITY;
        for(int i=0;i<nro_iteraciones;i++){
            double mejor_costo_iteracion = Double.POSITIVE_INFINITY;
            RutaEnvio mejor_solucion_iteracion = new RutaEnvio();
            for(int h=0;h<nro_hormigas;h++){
                Hormigo hormiga = new Hormigo(envio,fermonas,vuelos,aeropuertos,alpha,beta);
                hormiga.construirSolucion();
                RutaEnvio ruta = hormiga.getRuta();
                double costo_hormiga = hormiga.getCostoTotal();
                if(hormiga.getEsFactible()){
                    if(costo_hormiga < mejor_costo_iteracion){
                        mejor_costo_iteracion = costo_hormiga;
                        mejor_solucion_iteracion = ruta;
                    }
                }
                vuelos.deshacerRutaEnvio(ruta);
            }
            if(mejor_solucion_iteracion != null){
                fermonas.actualizarRuta(mejor_solucion_iteracion);
                if(mejor_costo_iteracion < mejor_costo_global){
                    mejor_costo_global = mejor_costo_iteracion;
                    solucion_global = mejor_solucion_iteracion;
                }
            }
        }
        vuelos.efectuarRutaEnvio(solucion_global);
        //Imprimir cada envio
        //imprimirDetalleRuta(envio, solucion_global);
        //System.out.println("=========================");
        //imprimirRuta(solucion_global);
        //System.out.println("=========================");
        // */
        // ¿global? -> fermonas.actualizar(null);
        return solucion_global;
    }

    private void imprimirRuta(RutaEnvio ruta) {
        if (ruta == null) return;

        for (VueloFecha vuelo : ruta.getVuelos()) {
            String origen = vuelo.getVueloBase().getOrigen().getCodigo();
            String destino = vuelo.getVueloBase().getDestino().getCodigo();
            AlmacenAeropuerto almacenOrigen = vuelos.getAlmacen(origen);
            AlmacenAeropuerto almacenDestino = vuelos.getAlmacen(destino);
            if(origen.equals(ruta.getEnvio().getOrigen().getCodigo())){
                almacenOrigen.imprimir(vuelo.getFechaHoraSalida().toLocalDate());
            }
            almacenDestino.imprimir(vuelo.getFechaHoraLlegada().toLocalDate());
        }
    }

    public static void imprimirDetalleRuta(Envio envio, RutaEnvio ruta) {
        System.out.println("Envio ID: " + envio.getId());
        System.out.println("Origen: " + envio.getOrigen());
        System.out.println("Destino: " + envio.getDestino());
        System.out.println("Hora de envio: " + envio.getDiaHoraIngreso().toLocalDate() + " " + envio.getDiaHoraIngreso().toLocalTime());
        System.out.println("Tiempo total: " + ruta.getTiempoTotal());

        System.out.println("Ruta:");

        for (VueloFecha vf : ruta.getVuelos()) {
            VueloDiario vuelo = vf.getVueloBase();

            System.out.println("  Fecha: " + vf.getFecha());
            System.out.println("    Vuelo ID: " + vuelo.getId());
            System.out.println("    Origen: " + vuelo.getOrigen().getCodigo());
            System.out.println("    Destino: " + vuelo.getDestino().getCodigo());
            System.out.println("    Hora salida: " + vuelo.getHoraSalida());
            System.out.println("    Hora llegada: " + vuelo.getHoraLlegada());
        }
        System.out.println("==============================");
    }
}