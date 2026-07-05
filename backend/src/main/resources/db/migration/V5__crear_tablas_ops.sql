-- AEROPUERTOS
CREATE TABLE OPS_AIRPORT (
    iata_code   CHAR(4) PRIMARY KEY,
    name        VARCHAR(80),
    country     VARCHAR(60),
    short_code  CHAR(4),
    continent   VARCHAR(20),
    gmt_offset  SMALLINT,
    capacity    SMALLINT,
    latitude    DOUBLE,
    longitude   DOUBLE
);

-- PLAN DE VUELO BASE
CREATE TABLE OPS_FLIGHT_PLAN (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    origin_iata     CHAR(4),
    dest_iata       CHAR(4),
    dep_time_local  TIME,
    arr_time_local  TIME,
    capacity        SMALLINT,
    is_active       BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_flight_plan_origin
        FOREIGN KEY (origin_iata)
        REFERENCES OPS_AIRPORT(iata_code),

    CONSTRAINT fk_flight_plan_dest
        FOREIGN KEY (dest_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

-- VUELO CONCRETO
CREATE TABLE OPS_FLIGHT (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    flight_plan_id  INT,
    flight_date     DATE NOT NULL,
    origin_iata     CHAR(4),
    dest_iata       CHAR(4),
    dep_time_utc    TIMESTAMP NOT NULL,
    arr_time_utc    TIMESTAMP NOT NULL,
    capacity        SMALLINT,
    status          VARCHAR(20) DEFAULT 'SCHEDULED',
    cancel_reason   VARCHAR(200),

    UNIQUE KEY uk_flight_plan_date (flight_plan_id, flight_date),

    CONSTRAINT fk_flight_plan
        FOREIGN KEY (flight_plan_id)
        REFERENCES OPS_FLIGHT_PLAN(id),

    CONSTRAINT fk_flight_origin
        FOREIGN KEY (origin_iata)
        REFERENCES OPS_AIRPORT(iata_code),

    CONSTRAINT fk_flight_dest
        FOREIGN KEY (dest_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

-- ENVIO
CREATE TABLE OPS_SHIPMENT (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    external_id     VARCHAR(20) UNIQUE,
    registered_at   TIMESTAMP NOT NULL,
    origin_iata     CHAR(4),
    dest_iata       CHAR(4),
    bag_count       SMALLINT NOT NULL,
    client_code     VARCHAR(10),
    status          VARCHAR(20) DEFAULT 'PENDING',
    deadline_utc    TIMESTAMP NULL,
    last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_shipment_origin
        FOREIGN KEY (origin_iata)
        REFERENCES OPS_AIRPORT(iata_code),

    CONSTRAINT fk_shipment_dest
        FOREIGN KEY (dest_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

-- RUTA ASIGNADA
CREATE TABLE OPS_SHIPMENT_ROUTE (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id     INT,
    step_order      SMALLINT NOT NULL,
    flight_id       INT,
    status          VARCHAR(20) DEFAULT 'PENDING',
    actual_arr_utc  TIMESTAMP NULL,

    UNIQUE KEY uk_shipment_route (shipment_id, step_order),

    CONSTRAINT fk_route_shipment
        FOREIGN KEY (shipment_id)
        REFERENCES OPS_SHIPMENT(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_route_flight
        FOREIGN KEY (flight_id)
        REFERENCES OPS_FLIGHT(id)
);

-- HISTORIAL DE POSICION
CREATE TABLE OPS_SHIPMENT_EVENT (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    shipment_id INT NOT NULL,

    event_time_utc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    event_type VARCHAR(30),

    airport_iata CHAR(4),

    notes VARCHAR(200),

    CONSTRAINT fk_shipment_event_shipment
        FOREIGN KEY (shipment_id)
        REFERENCES OPS_SHIPMENT(id),

    CONSTRAINT fk_shipment_event_airport
        FOREIGN KEY (airport_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

-- LOG DE EJECUCIONES
CREATE TABLE OPS_PLANNER_RUN (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    run_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    triggered_by        VARCHAR(20),
    shipments_planned   INT,
    notes               VARCHAR(200)
);

-- USUARIO
CREATE TABLE OPS_USER (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    username        VARCHAR(20) UNIQUE NOT NULL,
    password        VARCHAR(100) NOT NULL,
    airport_iata    CHAR(4),

    CONSTRAINT fk_user_airport
        FOREIGN KEY (airport_iata)
        REFERENCES OPS_AIRPORT(iata_code)
);

-- INDICES
CREATE INDEX idx_ops_flight_date_status
    ON OPS_FLIGHT(flight_date, status);

CREATE INDEX idx_ops_shipment_status
    ON OPS_SHIPMENT(status);

CREATE INDEX idx_ops_shipment_event_ship_id
    ON OPS_SHIPMENT_EVENT(shipment_id);

CREATE INDEX idx_ops_route_shipment_id
    ON OPS_SHIPMENT_ROUTE(shipment_id);