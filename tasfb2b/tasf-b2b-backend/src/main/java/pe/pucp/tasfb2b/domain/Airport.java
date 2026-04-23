package pe.pucp.tasfb2b.domain;

import pe.pucp.tasfb2b.domain.enums.Continent;

public record Airport(
    String codigoIata,
    String ciudad,
    String pais,
    Continent continente,
    double latitud,
    double longitud,
    int capacidadMaxima,
    int zonaHorariaOffset
) {}
