import java.util.Objects;

public class Aeropuerto {
    private int id;
    private String codigo;
    private String pais;
    private String continente;
    private int gmt;
    private int capacidadMaxima;
    
    public Aeropuerto(int id, int gmt, String pais, String codigo, String continente, int capacidad) {
        this.id = id;
        this.codigo = codigo;
        this.gmt = gmt;
        this.pais = pais;
        this.continente = continente;
        this.capacidadMaxima = capacidad;
    }
    
    public String getCodigo() { return codigo; }
    public String getContinente() { return continente; }
    public int getCapacidadMaxima() { return capacidadMaxima; }
    public int getId() { return id; }
    public int getGmt() { return gmt; }
    public String getPais() { return pais; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Aeropuerto that = (Aeropuerto) o;
        return Objects.equals(codigo, that.codigo);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(codigo);
    }
    
    @Override
    public String toString() {
        return id + " - " + codigo + " (" + continente + ")";
    }
}