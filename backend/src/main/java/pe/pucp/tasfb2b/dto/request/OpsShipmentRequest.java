package pe.pucp.tasfb2b.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class OpsShipmentRequest {
    private String almacenOrigen;
    private String almacenDestino;
    private String cantidadMaletas;
    private String cliente;
}
