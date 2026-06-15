-- V1: Tablas base: airlines y airports
-- SET NAMES utf8mb4;
-- SET CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS airlines (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    name          VARCHAR(120)    NOT NULL,
    iata_code     CHAR(2)         NOT NULL,
    contact_email VARCHAR(120)    NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_airlines_iata (iata_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS airports (
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
    UNIQUE KEY uq_airports_iata (iata_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;