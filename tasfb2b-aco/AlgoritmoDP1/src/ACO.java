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
        List<VueloDiario> vuelos_base){
        
        this.nro_hormigas = nro_hormigas;
        this.nro_iteraciones = nro_iteraciones;
        this.alpha = alpha;
        this.beta = beta;
        this.aeropuertos = aeropuertos;
        this.vuelos = new ListaVuelosDia(vuelos_base,aeropuertos);
        this.fermonas = new MatrizFeromonas3D(aeropuertos.size(),q,tau0,rho);
    }

    public RutaEnvio ejecutar(Envio envio){
        RutaEnvio solucion_global = null;
        double mejor_costo_global = Double.POSITIVE_INFINITY;
        
        for(int i=0;i<nro_iteraciones;i++){
            fermonas.avanzarIteracion();
            double mejor_costo_iteracion = Double.POSITIVE_INFINITY;
            RutaEnvio mejor_solucion_iteracion = null;
            
            for(int h=0;h<nro_hormigas;h++){
                Hormigo hormiga = new Hormigo(envio,fermonas,vuelos,aeropuertos,alpha,beta);
                hormiga.construirSolucion();
                RutaEnvio ruta = hormiga.getRuta();
                double costo_hormiga = hormiga.getCostoTotal();
                
                if(hormiga.getEsFactible()){
                    if(costo_hormiga < mejor_costo_iteracion){
                        mejor_costo_iteracion = costo_hormiga;
                        mejor_solucion_iteracion = new RutaEnvio(ruta);
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
        
        if (solucion_global != null) {
            vuelos.efectuarRutaEnvio(solucion_global);
        }
        return solucion_global;
    }
}
