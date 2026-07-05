package pe.pucp.tasfb2b.dto.request;

public class EnvioRequest {

    private String almacenOrigen;
    private String almacenDestino;
    private String cantidadMaletas; // "001" .. "999"
    private String cliente;         // texto libre, ingresado en el registro

    public String getAlmacenOrigen() { return almacenOrigen; }
    public void setAlmacenOrigen(String almacenOrigen) { this.almacenOrigen = almacenOrigen; }

    public String getAlmacenDestino() { return almacenDestino; }
    public void setAlmacenDestino(String almacenDestino) { this.almacenDestino = almacenDestino; }

    public String getCantidadMaletas() { return cantidadMaletas; }
    public void setCantidadMaletas(String cantidadMaletas) { this.cantidadMaletas = cantidadMaletas; }

    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }
}
