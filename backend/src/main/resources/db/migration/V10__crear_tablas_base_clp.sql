-- V10: Tabla base de aeropuertos para el escenario de Simulación de Colapso (Clp_)
-- Espejo estructural de `airports`, pero con estado de ocupación independiente
-- para poder correr en paralelo con una simulación 5D sin pisarse datos.
CREATE TABLE IF NOT EXISTS Clp_airports (
    id                  BIGINT  NOT NULL AUTO_INCREMENT,
    iata_code           VARCHAR(4)       NOT NULL,
    city                VARCHAR(120)     NOT NULL,
    country             VARCHAR(80)      NOT NULL,
    continent           VARCHAR(20)      NOT NULL,
    warehouse_capacity  INT     NOT NULL,
    current_occupancy   INT     NOT NULL DEFAULT 0,
    gmt_offset          INT     NOT NULL DEFAULT 0,
    latitude            DECIMAL(9,6)     NOT NULL,
    longitude           DECIMAL(9,6)     NOT NULL,
    created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clp_airports_iata (iata_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
