package pe.pucp.tasfb2b.dto.request;

public class EnvioRequest {

    private String almacenOrigen;
    private String almacenDestino;
    private String cantidadMaletas; // "001" .. "999"
    private String cliente;         // texto libre, ingresado en el registro

    // ── Campos opcionales de presentación (carga masiva) ──────────────────
    // Si vienen informados, representan la hora LOCAL de la sede origen
    // (formato del archivo: aaaammdd / hh / mm), tal como indicó el profesor.
    // Si vienen null/blank, el backend usa la hora actual del servidor
    // (comportamiento de siempre para el registro manual).
    private String fecha;  // "aaaammdd", ej. "20260708"
    private String hora;   // "hh", ej. "14"
    private String minuto; // "mm", ej. "30"

    public String getAlmacenOrigen() { return almacenOrigen; }
    public void setAlmacenOrigen(String almacenOrigen) { this.almacenOrigen = almacenOrigen; }

    public String getAlmacenDestino() { return almacenDestino; }
    public void setAlmacenDestino(String almacenDestino) { this.almacenDestino = almacenDestino; }

    public String getCantidadMaletas() { return cantidadMaletas; }
    public void setCantidadMaletas(String cantidadMaletas) { this.cantidadMaletas = cantidadMaletas; }

    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }

    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }

    public String getHora() { return hora; }
    public void setHora(String hora) { this.hora = hora; }

    public String getMinuto() { return minuto; }
    public void setMinuto(String minuto) { this.minuto = minuto; }
}