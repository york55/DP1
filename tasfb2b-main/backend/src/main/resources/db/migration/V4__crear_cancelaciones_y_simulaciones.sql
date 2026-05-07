-- V4: Cancelaciones, simulaciones, KPI y historial de estados
CREATE TABLE IF NOT EXISTS flight_cancellations (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    flight_id    BIGINT UNSIGNED NOT NULL,
    cancelled_at DATETIME        NOT NULL,
    reason       VARCHAR(255)    NULL,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_cancellations_flight FOREIGN KEY (flight_id) REFERENCES flights(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulations (
    id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    scenario_type       VARCHAR(32)      NOT NULL DEFAULT 'PERIOD',
    period_days         INT UNSIGNED     NULL,
    start_date          DATE             NOT NULL,
    cancellation_rate   DECIMAL(5,2)     NOT NULL DEFAULT 10.00,
    seed                BIGINT           NOT NULL DEFAULT 42,
    volume_per_day      INT UNSIGNED     NOT NULL DEFAULT 10,
    status              VARCHAR(32)      NOT NULL DEFAULT 'CONFIGURED',
    algorithm           VARCHAR(20)      NOT NULL DEFAULT 'ALNS',
    t0                  DECIMAL(10,4)    NULL,
    alpha_sa            DECIMAL(6,5)     NULL,
    q_pct               DECIMAL(5,3)     NULL,
    max_iterations      INT UNSIGNED     NULL,
    simulated_time      DATETIME         NULL,
    created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id           BIGINT UNSIGNED NOT NULL,
    snapshot_time           DATETIME        NOT NULL,
    on_time_pct             DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    delayed_count           INT UNSIGNED    NOT NULL DEFAULT 0,
    avg_flight_occupancy    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    avg_warehouse_occupancy DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_kpi_simulation FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipment_status_history (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id BIGINT UNSIGNED NOT NULL,
    old_status  VARCHAR(32)     NOT NULL,
    new_status  VARCHAR(32)     NOT NULL,
    airport_id  BIGINT UNSIGNED NULL,
    changed_at  DATETIME        NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_history_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_history_airport  FOREIGN KEY (airport_id)  REFERENCES airports(id)  ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
