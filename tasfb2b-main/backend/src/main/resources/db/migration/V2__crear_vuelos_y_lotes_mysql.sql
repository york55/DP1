-- V2: Tablas de vuelos y lotes de maletas
CREATE TABLE IF NOT EXISTS flights (
    id                    BIGINT NOT NULL AUTO_INCREMENT,
    airline_id            BIGINT NULL,
    origin_airport_id     BIGINT NOT NULL,
    destination_airport_id BIGINT NOT NULL,
    departure_time        DATETIME        NOT NULL,
    arrival_time          DATETIME        NOT NULL,
    baggage_capacity      INT    NOT NULL,
    current_load          INT    NOT NULL DEFAULT 0,
    frequency             VARCHAR(20)     NOT NULL DEFAULT 'DAILY',
    status                VARCHAR(32)     NOT NULL DEFAULT 'SCHEDULED',
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_flights_airline     FOREIGN KEY (airline_id)             REFERENCES airlines(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_flights_origin      FOREIGN KEY (origin_airport_id)      REFERENCES airports(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_flights_destination FOREIGN KEY (destination_airport_id) REFERENCES airports(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS baggage_batches (
    id                    BIGINT NOT NULL AUTO_INCREMENT,
    airline_id            BIGINT NOT NULL,
    origin_airport_id     BIGINT NOT NULL,
    destination_airport_id BIGINT NOT NULL,
    quantity              INT    NOT NULL,
    status                VARCHAR(32)     NOT NULL DEFAULT 'IN_ORIGIN',
    available_from        DATETIME        NOT NULL,
    notes                 TEXT            NULL,
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_batches_airline      FOREIGN KEY (airline_id)             REFERENCES airlines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batches_origin       FOREIGN KEY (origin_airport_id)      REFERENCES airports(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batches_destination  FOREIGN KEY (destination_airport_id) REFERENCES airports(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;