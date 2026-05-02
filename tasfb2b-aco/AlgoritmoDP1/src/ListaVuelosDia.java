import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ListaVuelosDia {

    private Map<Integer, VueloDiario> vuelosPorId;
    private Map<String, List<VueloDiario>> vuelosPorOrigen;

    //Maletas acumuladas que llegan a cada aeropuerto por fecha
    private Map<String,AlmacenAeropuerto> almacenes;

    public ListaVuelosDia(List<VueloDiario> lista,Map<String, Aeropuerto> aeropuertos){
        vuelosPorId = new HashMap<>();
        vuelosPorOrigen = new HashMap<>();
        almacenes = new HashMap<>();
        // Preprocesamiento O(n) (solo una vez)
        for (VueloDiario v : lista) {
            vuelosPorId.put(v.getId(), v);
            vuelosPorOrigen
                .computeIfAbsent(v.getOrigen().getCodigo(), k -> new ArrayList<>())
                .add(v);
        }
        // Crear un almacén por cada aeropuerto
        for (Map.Entry<String, Aeropuerto> entry : aeropuertos.entrySet()) {
            almacenes.put(entry.getKey(), new AlmacenAeropuerto(entry.getValue()));
        }
    }

    public AlmacenAeropuerto getAlmacen(String codigoAeropuerto) {
        return almacenes.get(codigoAeropuerto);
    }

    public VueloFecha efectuarEnvioVuelo(VueloDiario vueloElegido, LocalDate tiempo,Envio envio){
        VueloDiario vuelo = vuelosPorId.get(vueloElegido.getId());
        if (vuelo == null) return null;
        VueloFecha vf = vuelo.getVueloFecha(tiempo);
        if (vf == null) return null;
        vf.agregarEnvio(envio);
        /* agregar envio en almacen segun su fecha (numero de maletas, hora de salida)*/
        almacenes
            .get(vf.getVueloBase().getOrigen().getCodigo())
            .registrarSalida(
                envio, 
                vf.getFechaHoraSalida()
            );
        almacenes
            .get(vf.getVueloBase().getDestino().getCodigo())
            .registrarLlegada(
                envio,
                vf.getFechaHoraLlegada()
            );
        return vf;
    }

    public List<VueloDiario> obtenerPorOrigen(String origen){
        return vuelosPorOrigen.getOrDefault(origen, Collections.emptyList());
    }

    public void deshacerRutaEnvio(RutaEnvio ruta){
        Envio envio = ruta.getEnvio();
        for (VueloFecha vf : ruta.getVuelos()) {
            vf.quitarEnvio(envio);
            //Deshacer lo hecho en almacen
            VueloDiario vuelo = vf.getVueloBase();
            LocalDateTime momentoSalida  = vf.getFechaHoraSalida();
            LocalDateTime momentoLlegada = vf.getFechaHoraLlegada();
            almacenes
                .get(vuelo.getOrigen().getCodigo())
                .revertirSalida(envio.getCantidad_maletas(), momentoSalida);
            almacenes
                .get(vuelo.getDestino().getCodigo())
                .revertirLlegada(envio.getCantidad_maletas(), momentoLlegada);
        }
    }

    public void efectuarRutaEnvio(RutaEnvio ruta){
        if(ruta == null) return;
        Envio envio = ruta.getEnvio();
        for (VueloFecha vf : ruta.getVuelos()) {
            vf.agregarEnvio(envio);
            almacenes
            .get(vf.getVueloBase().getOrigen().getCodigo())
            .registrarSalida(
                envio,
                vf.getFechaHoraSalida()
            );
            almacenes
                .get(vf.getVueloBase().getDestino().getCodigo())
                .registrarLlegada(
                    envio,
                    vf.getFechaHoraLlegada()
                );
        }
    }

}
