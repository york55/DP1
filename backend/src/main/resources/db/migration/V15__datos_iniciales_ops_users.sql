-- ============================================================
-- OPS_USER - Creación de tabla + carga inicial de usuarios
-- (Se crea aquí porque V5 ya estaba aplicado en el entorno antes
--  de agregarle esta tabla, así que Flyway no la vuelve a ejecutar.
--  Si tu V5 real todavía no se ha corrido nunca en ninguna BD y
--  ya incluye OPS_USER, quita el CREATE TABLE de aquí y deja solo
--  el INSERT para evitar el error de tabla duplicada.)
-- ============================================================

CREATE TABLE IF NOT EXISTS OPS_USER (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    username        VARCHAR(20) UNIQUE NOT NULL,
    password        VARCHAR(100) NOT NULL,
    airport_iata    CHAR(4),

    CONSTRAINT fk_user_airport
        FOREIGN KEY (airport_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

INSERT IGNORE INTO OPS_USER (full_name, username, password, airport_iata) VALUES
('Matias Chavarria', '20222232', '20222232', 'SPIM'),
('Jorge Vicente',     '20222159', '20222159', 'SABE'),
('Rodrigo Lujan',     '20211601', '20211601', 'EKCH'),
('Marcelo Jara',      '20193208', '20193208', 'VIDP');