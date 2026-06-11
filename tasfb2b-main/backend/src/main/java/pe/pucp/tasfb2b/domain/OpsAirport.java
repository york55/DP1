package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "OPS_AIRPORT")
@Getter @Setter @NoArgsConstructor
public class OpsAirport {

    @Id
    @Column(name = "iata_code", length = 4)
    private String iataCode;

    @Column(name = "name", length = 80)
    private String name;

    @Column(name = "country", length = 60)
    private String country;

    @Column(name = "short_code", length = 4)
    private String shortCode;

    @Column(name = "continent", length = 20)
    private String continent;

    @Column(name = "gmt_offset")
    private Integer gmtOffset;

    @Column(name = "capacity")
    private Integer capacity;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;
}