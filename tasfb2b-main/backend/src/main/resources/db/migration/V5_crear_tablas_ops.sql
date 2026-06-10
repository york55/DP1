-- AEROPUERTOS (maestro, se carga una vez)
CREATE TABLE OPS_AIRPORT (
    iata_code   CHAR(4)     PRIMARY KEY,
    name        VARCHAR(80),
    country     VARCHAR(60),
    short_code  CHAR(4),
    continent   VARCHAR(20),               -- SOUTH_AMERICA, EUROPE, ASIA
    gmt_offset  SMALLINT,
    capacity    SMALLINT,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION
);

-- PLAN DE VUELO BASE (plantilla diaria recurrente)
CREATE TABLE OPS_FLIGHT_PLAN (
    id              SERIAL PRIMARY KEY,
    origin_iata     CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    dest_iata       CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    dep_time_local  TIME,
    arr_time_local  TIME,
    capacity        SMALLINT,
    is_active       BOOLEAN DEFAULT TRUE
);

-- VUELO CONCRETO (instancia diaria del plan)
CREATE TABLE OPS_FLIGHT (
    id              SERIAL PRIMARY KEY,
    flight_plan_id  INT REFERENCES OPS_FLIGHT_PLAN(id),
    flight_date     DATE NOT NULL,
    origin_iata     CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    dest_iata       CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    dep_time_utc    TIMESTAMP NOT NULL,
    arr_time_utc    TIMESTAMP NOT NULL,
    capacity        SMALLINT,
    status          VARCHAR(20) DEFAULT 'SCHEDULED',
    -- SCHEDULED | CANCELLED | DEPARTED | ARRIVED
    cancel_reason   VARCHAR(200),
    UNIQUE (flight_plan_id, flight_date)
);

-- ENVIO
CREATE TABLE OPS_SHIPMENT (
    id              SERIAL PRIMARY KEY,
    external_id     VARCHAR(20) UNIQUE,
    registered_at   TIMESTAMP NOT NULL,
    origin_iata     CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    dest_iata       CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    bag_count       SMALLINT NOT NULL,
    client_code     VARCHAR(10),
    status          VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING | PLANNED | IN_TRANSIT | DELIVERED | DELAYED
    deadline_utc    TIMESTAMP,
    last_updated    TIMESTAMP DEFAULT NOW()
);

-- RUTA ASIGNADA (output del planificador)
CREATE TABLE OPS_SHIPMENT_ROUTE (
    id              SERIAL PRIMARY KEY,
    shipment_id     INT REFERENCES OPS_SHIPMENT(id) ON DELETE CASCADE,
    step_order      SMALLINT NOT NULL,
    flight_id       INT REFERENCES OPS_FLIGHT(id),
    status          VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING | BOARDED | ARRIVED | SKIPPED
    actual_arr_utc  TIMESTAMP,
    UNIQUE (shipment_id, step_order)
);

-- HISTORIAL DE POSICIÓN (para el visualizador)
CREATE TABLE OPS_SHIPMENT_EVENT (
    id              BIGSERIAL PRIMARY KEY,
    shipment_id     INT REFERENCES OPS_SHIPMENT(id),
    event_time_utc  TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type      VARCHAR(30),
    -- REGISTERED | DEPARTED | ARRIVED | DELIVERED | DELAYED | REPLANNED
    airport_iata    CHAR(4) REFERENCES OPS_AIRPORT(iata_code),
    notes           VARCHAR(200)
);

-- LOG DE EJECUCIONES DEL PLANIFICADOR
CREATE TABLE OPS_PLANNER_RUN (
    id              SERIAL PRIMARY KEY,
    run_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    triggered_by    VARCHAR(20),           -- SCHEDULED | MANUAL | CANCELLATION
    shipments_planned INT,
    notes           VARCHAR(200)
);

-- ÍNDICES RECOMENDADOS
CREATE INDEX idx_ops_flight_date_status     ON OPS_FLIGHT(flight_date, status);
CREATE INDEX idx_ops_shipment_status        ON OPS_SHIPMENT(status);
CREATE INDEX idx_ops_shipment_event_ship_id ON OPS_SHIPMENT_EVENT(shipment_id);
CREATE INDEX idx_ops_route_shipment_id      ON OPS_SHIPMENT_ROUTE(shipment_id);