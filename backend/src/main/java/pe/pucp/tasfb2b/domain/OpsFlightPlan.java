package pe.pucp.tasfb2b.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalTime;

@Entity
@Table(name = "OPS_FLIGHT_PLAN")
@Getter @Setter @NoArgsConstructor
public class OpsFlightPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "origin_iata", length = 4)
    private String originIata;

    @Column(name = "dest_iata", length = 4)
    private String destIata;

    @Column(name = "dep_time_local")
    private LocalTime depTimeLocal;

    @Column(name = "arr_time_local")
    private LocalTime arrTimeLocal;

    @Column(name = "capacity")
    private Integer capacity;

    @Column(name = "is_active")
    private Boolean isActive = true;
}
