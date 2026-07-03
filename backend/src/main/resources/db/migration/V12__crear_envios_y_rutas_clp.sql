-- V12: Envíos y rutas para el escenario de Simulación de Colapso (Clp_)
CREATE TABLE IF NOT EXISTS Clp_shipments (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    baggage_batch_id BIGINT NOT NULL,
    status           VARCHAR(32)     NOT NULL DEFAULT 'PLANNED',
    deadline         DATETIME        NOT NULL,
    delivered_at     DATETIME        NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clp_shipments_batch (baggage_batch_id),
    CONSTRAINT fk_clp_shipments_batch FOREIGN KEY (baggage_batch_id) REFERENCES Clp_baggage_batches(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Clp_routes (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    shipment_id      BIGINT NOT NULL,
    total_legs       INT    NOT NULL,
    algorithm_used   VARCHAR(20)     NOT NULL DEFAULT 'ALNS',
    estimated_arrival DATETIME       NOT NULL,
    actual_arrival   DATETIME        NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clp_routes_shipment (shipment_id),
    CONSTRAINT fk_clp_routes_shipment FOREIGN KEY (shipment_id) REFERENCES Clp_shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Clp_route_legs (
    id        BIGINT NOT NULL AUTO_INCREMENT,
    route_id  BIGINT NOT NULL,
    flight_id BIGINT NOT NULL,
    leg_order INT    NOT NULL,
    status    VARCHAR(32)     NOT NULL DEFAULT 'PENDING',
    created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_clp_legs_route  FOREIGN KEY (route_id)  REFERENCES Clp_routes(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_clp_legs_flight FOREIGN KEY (flight_id) REFERENCES Clp_flights(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
