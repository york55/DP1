-- V13: Cancelaciones, simulaciones de colapso, KPI e historial de estados (Clp_)
CREATE TABLE IF NOT EXISTS Clp_flight_cancellations (
    id           BIGINT NOT NULL AUTO_INCREMENT,
    flight_id    BIGINT NOT NULL,
    cancelled_at DATETIME        NOT NULL,
    reason       VARCHAR(255)    NULL,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_clp_cancellations_flight FOREIGN KEY (flight_id) REFERENCES Clp_flights(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clp_simulations reemplaza `period_days` (que no aplica: no hay duración fija)
-- por columnas propias del escenario de colapso:
--   * days_simulated:      contador de días simulados, se incrementa en cada bloque de 24h
--   * last_read_until:     hasta qué fecha ya se leyeron envíos (para la lectura periódica
--                          de 5 días + 1 día de colchón, permite reanudar tras un restart)
--   * collapsed_at / collapsed_airport_id: se completan cuando algún almacén supera el 100%
--                          de su warehouse_capacity y la simulación termina
CREATE TABLE IF NOT EXISTS Clp_simulations (
    id                  BIGINT  NOT NULL AUTO_INCREMENT,
    scenario_type       VARCHAR(32)      NOT NULL DEFAULT 'COLLAPSE',
    start_date          DATETIME         NOT NULL,
    cancellation_rate   DECIMAL(5,2)     NOT NULL DEFAULT 10.00,
    seed                BIGINT           NOT NULL DEFAULT 42,
    volume_per_day      INT     NOT NULL DEFAULT 10,
    status              VARCHAR(32)      NOT NULL DEFAULT 'CONFIGURED',
    algorithm           VARCHAR(20)      NOT NULL DEFAULT 'ALNS',
    t0                  DECIMAL(10,4)    NULL,
    alpha_sa            DECIMAL(6,5)     NULL,
    q_pct               DECIMAL(5,3)     NULL,
    max_iterations      INT     NULL,
    simulated_time      DATETIME         NULL,
    days_simulated      INT     NOT NULL DEFAULT 0,
    last_read_until     DATETIME         NULL,
    collapsed_at         DATETIME        NULL,
    collapsed_airport_id BIGINT          NULL,
    created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_clp_simulations_collapsed_airport FOREIGN KEY (collapsed_airport_id) REFERENCES Clp_airports(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Clp_kpi_snapshots (
    id                      BIGINT NOT NULL AUTO_INCREMENT,
    simulation_id           BIGINT NOT NULL,
    snapshot_time           DATETIME        NOT NULL,
    on_time_pct             DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    delayed_count           INT    NOT NULL DEFAULT 0,
    avg_flight_occupancy    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    avg_warehouse_occupancy DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_clp_kpi_simulation FOREIGN KEY (simulation_id) REFERENCES Clp_simulations(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Clp_shipment_status_history (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    shipment_id BIGINT NOT NULL,
    old_status  VARCHAR(32)     NOT NULL,
    new_status  VARCHAR(32)     NOT NULL,
    airport_id  BIGINT NULL,
    changed_at  DATETIME        NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_clp_history_shipment FOREIGN KEY (shipment_id) REFERENCES Clp_shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_clp_history_airport  FOREIGN KEY (airport_id)  REFERENCES Clp_airports(id)  ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
