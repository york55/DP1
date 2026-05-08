-- V5: Datos semilla para demo (H2 compatible)
-- Aerolíneas
INSERT INTO airlines (name, iata_code, contact_email) VALUES
    ('American Airlines', 'AA', 'ops@aa.com'),
    ('LATAM Airlines',    'LA', 'ops@latam.com'),
    ('Iberia',            'IB', 'ops@iberia.com'),
    ('United Airlines',   'UA', 'ops@united.com'),
    ('Lufthansa',         'LH', 'ops@lh.com');

-- Aeropuertos (20)
INSERT INTO airports (iata_code, city, country, continent, warehouse_capacity, latitude, longitude) VALUES
    ('LIM', 'Lima',            'Perú',          'Americas',    650,  -12.021900, -77.114300),
    ('JFK', 'New York',        'USA',            'Americas',    750,   40.641300, -73.778100),
    ('CDG', 'Paris',           'Francia',        'Europe',      800,   49.009700,   2.547900),
    ('NRT', 'Tokyo',           'Japón',          'Asia',        700,   35.765300, 140.385500),
    ('GRU', 'São Paulo',       'Brasil',         'Americas',    600,  -23.435600, -46.473100),
    ('MAD', 'Madrid',          'España',         'Europe',      750,   40.471900,  -3.562600),
    ('DXB', 'Dubai',           'UAE',            'Middle East', 800,   25.253200,  55.365700),
    ('SYD', 'Sydney',          'Australia',      'Oceania',     550,  -33.946100, 151.177200),
    ('YYZ', 'Toronto',         'Canada',         'Americas',    650,   43.677700, -79.624800),
    ('EZE', 'Buenos Aires',    'Argentina',      'Americas',    600,  -34.822200, -58.535800),
    ('BOG', 'Bogotá',          'Colombia',       'Americas',    500,    4.701600, -74.146900),
    ('SCL', 'Santiago',        'Chile',          'Americas',    580,  -33.392800, -70.785600),
    ('MIA', 'Miami',           'USA',            'Americas',    720,   25.795900, -80.287000),
    ('LAX', 'Los Ángeles',     'USA',            'Americas',    780,   33.942500,-118.408100),
    ('LHR', 'Londres',         'Reino Unido',    'Europe',      800,   51.477500,  -0.461400),
    ('FRA', 'Frankfurt',       'Alemania',       'Europe',      750,   50.033300,   8.570600),
    ('SIN', 'Singapur',        'Singapore',      'Asia',        680,    1.364400, 103.991500),
    ('ICN', 'Seúl',            'Corea del Sur',  'Asia',        700,   37.460200, 126.440700),
    ('MEX', 'Ciudad de México','México',         'Americas',    620,   19.436100, -99.071900),
    ('MXP', 'Milán',           'Italia',         'Europe',      600,   45.630600,   8.723100);

-- Vuelos para el 2026-05-10
INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
SELECT o.id, dst.id, '2026-05-10 08:00:00', '2026-05-11 08:00:00', 350, 'DAILY', 'SCHEDULED' FROM airports o, airports dst WHERE o.iata_code='JFK' AND dst.iata_code='CDG';
INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
SELECT o.id, dst.id, '2026-05-10 06:00:00', '2026-05-10 18:00:00', 200, 'DAILY', 'SCHEDULED' FROM airports o, airports dst WHERE o.iata_code='LIM' AND dst.iata_code='GRU';
INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
SELECT o.id, dst.id, '2026-05-10 12:00:00', '2026-05-11 12:00:00', 400, 'DAILY', 'SCHEDULED' FROM airports o, airports dst WHERE o.iata_code='CDG' AND dst.iata_code='NRT';

-- Vuelos para el 2026-05-11
INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
SELECT o.id, dst.id, '2026-05-11 08:00:00', '2026-05-12 08:00:00', 350, 'DAILY', 'SCHEDULED' FROM airports o, airports dst WHERE o.iata_code='JFK' AND dst.iata_code='CDG';
INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
SELECT o.id, dst.id, '2026-05-11 06:00:00', '2026-05-11 18:00:00', 200, 'DAILY', 'SCHEDULED' FROM airports o, airports dst WHERE o.iata_code='LIM' AND dst.iata_code='GRU';

-- 30 lotes de maletas iniciales
INSERT INTO baggage_batches (airline_id, origin_airport_id, destination_airport_id, quantity, status, available_from, notes)
SELECT a.id, o.id, d.id, qty, status, avail, notes FROM (
    SELECT 1 AS aid, 'JFK' AS orig, 'CDG' AS dest, 120 AS qty, 'IN_ORIGIN' AS status, '2026-05-10 06:00:00' AS avail, 'Lote AA JFK-CDG' AS notes UNION ALL
    SELECT 2, 'LIM', 'GRU', 80,  'IN_ORIGIN',  '2026-05-10 05:00:00', 'Lote LA LIM-GRU'  UNION ALL
    SELECT 3, 'MAD', 'LHR', 60,  'IN_ORIGIN',  '2026-05-10 09:00:00', 'Lote IB MAD-LHR'  UNION ALL
    SELECT 4, 'MIA', 'LIM', 100, 'IN_ORIGIN',  '2026-05-10 06:30:00', 'Lote UA MIA-LIM'  UNION ALL
    SELECT 5, 'FRA', 'DXB', 150, 'IN_ORIGIN',  '2026-05-10 05:30:00', 'Lote LH FRA-DXB'
) AS data
JOIN airlines a ON a.id = data.aid
JOIN airports o ON o.iata_code = data.orig
JOIN airports d ON d.iata_code = data.dest;
