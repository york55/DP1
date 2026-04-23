import java.time.LocalDate;

class MovimientoCapacidad {
    private final Vuelo vuelo;
    private final LocalDate fecha;
    private final int cantidad;

    public MovimientoCapacidad(Vuelo vuelo, LocalDate fecha, int cantidad) {
        this.vuelo = vuelo;
        this.fecha = fecha;
        this.cantidad = cantidad;
    }

    public Vuelo getVuelo() { return vuelo; }
    public LocalDate getFecha() { return fecha; }
    public int getCantidad() { return cantidad; }
}