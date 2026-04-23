import java.util.Objects;

public class Aeropuerto {
    private String codigo;
    private String continente;
    
    public Aeropuerto(int idx, String codigo, String continente) {
        this.codigo = codigo;
        this.continente = continente;
    }
    
    public String getCodigo() { return codigo; }
    public String getContinente() { return continente; }
    
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
        return codigo + " (" + continente + ")";
    }
}