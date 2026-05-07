-- V3: Tablas de envíos y rutas
CREATE TABLE IF NOT EXISTS shipments (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    baggage_batch_id BIGINT UNSIGNED NOT NULL,
    status           VARCHAR(32)     NOT NULL DEFAULT 'PLANNED',
    deadline         DATETIME        NOT NULL,
    delivered_at     DATETIME        NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shipments_batch (baggage_batch_id),
    CONSTRAINT fk_shipments_batch FOREIGN KEY (baggage_batch_id) REFERENCES baggage_batches(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routes (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id      BIGINT UNSIGNED NOT NULL,
    total_legs       INT UNSIGNED    NOT NULL,
    algorithm_used   VARCHAR(20)     NOT NULL DEFAULT 'ALNS',
    estimated_arrival DATETIME       NOT NULL,
    actual_arrival   DATETIME        NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_routes_shipment (shipment_id),
    CONSTRAINT fk_routes_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS route_legs (
    id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    route_id  BIGINT UNSIGNED NOT NULL,
    flight_id BIGINT UNSIGNED NOT NULL,
    leg_order INT UNSIGNED    NOT NULL,
    status    VARCHAR(32)     NOT NULL DEFAULT 'PENDING',
    created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_legs_route  FOREIGN KEY (route_id)  REFERENCES routes(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_legs_flight FOREIGN KEY (flight_id) REFERENCES flights(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
