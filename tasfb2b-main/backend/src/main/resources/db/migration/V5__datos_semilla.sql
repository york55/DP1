-- V5: Datos semilla para demo
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

-- Procedimiento para generar vuelos repetidos por día
DROP PROCEDURE IF EXISTS gen_flights;
DELIMITER $$
CREATE PROCEDURE gen_flights()
BEGIN
    DECLARE d INT DEFAULT 0;
    DECLARE base_date DATE DEFAULT '2026-05-10';

    WHILE d < 7 DO
        SET @dep_date = DATE_ADD(base_date, INTERVAL d DAY);
        SET @next_date = DATE_ADD(base_date, INTERVAL (d+1) DAY);

        -- FL-001: JFK→CDG intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 08:00:00'), CONCAT(@next_date, ' 08:00:00'),
               350, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='JFK' AND dst.iata_code='CDG';

        -- FL-002: LIM→GRU intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 06:00:00'), CONCAT(@dep_date, ' 18:00:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LIM' AND dst.iata_code='GRU';

        -- FL-003: CDG→NRT intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 12:00:00'), CONCAT(@next_date, ' 12:00:00'),
               400, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='CDG' AND dst.iata_code='NRT';

        -- FL-004: NRT→SIN intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 09:00:00'), CONCAT(@dep_date, ' 21:00:00'),
               250, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='NRT' AND dst.iata_code='SIN';

        -- FL-005: MIA→LIM intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 07:00:00'), CONCAT(@dep_date, ' 13:00:00'),
               300, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MIA' AND dst.iata_code='LIM';

        -- FL-006: MAD→LHR intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 10:00:00'), CONCAT(@dep_date, ' 11:00:00'),
               180, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MAD' AND dst.iata_code='LHR';

        -- FL-007: LHR→CDG intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 14:00:00'), CONCAT(@dep_date, ' 15:30:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LHR' AND dst.iata_code='CDG';

        -- FL-008: FRA→DXB intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 06:00:00'), CONCAT(@dep_date, ' 13:00:00'),
               350, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='FRA' AND dst.iata_code='DXB';

        -- FL-009: DXB→SIN intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 02:00:00'), CONCAT(@dep_date, ' 12:00:00'),
               400, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='DXB' AND dst.iata_code='SIN';

        -- FL-010: SIN→ICN intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 15:00:00'), CONCAT(@dep_date, ' 23:00:00'),
               280, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='SIN' AND dst.iata_code='ICN';

        -- FL-011: ICN→NRT intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 08:00:00'), CONCAT(@dep_date, ' 10:00:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='ICN' AND dst.iata_code='NRT';

        -- FL-012: LAX→JFK intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 07:00:00'), CONCAT(@dep_date, ' 15:00:00'),
               350, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LAX' AND dst.iata_code='JFK';

        -- FL-013: MEX→MIA intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 10:00:00'), CONCAT(@dep_date, ' 14:00:00'),
               220, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MEX' AND dst.iata_code='MIA';

        -- FL-014: BOG→LIM intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 09:00:00'), CONCAT(@dep_date, ' 14:00:00'),
               180, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='BOG' AND dst.iata_code='LIM';

        -- FL-015: SCL→EZE intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 11:00:00'), CONCAT(@dep_date, ' 14:00:00'),
               150, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='SCL' AND dst.iata_code='EZE';

        -- FL-016: GRU→MIA intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 22:00:00'), CONCAT(@next_date, ' 06:00:00'),
               300, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='GRU' AND dst.iata_code='MIA';

        -- FL-017: YYZ→LAX intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 08:00:00'), CONCAT(@dep_date, ' 11:00:00'),
               250, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='YYZ' AND dst.iata_code='LAX';

        -- FL-018: CDG→FRA intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 16:00:00'), CONCAT(@dep_date, ' 18:00:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='CDG' AND dst.iata_code='FRA';

        -- FL-019: MXP→CDG intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 07:00:00'), CONCAT(@dep_date, ' 09:00:00'),
               180, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MXP' AND dst.iata_code='CDG';

        -- FL-020: LHR→JFK intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 11:00:00'), CONCAT(@dep_date, ' 14:00:00'),
               380, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LHR' AND dst.iata_code='JFK';

        -- FL-021: JFK→LIM intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 20:00:00'), CONCAT(@next_date, ' 06:00:00'),
               300, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='JFK' AND dst.iata_code='LIM';

        -- FL-022: LIM→MAD intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 23:00:00'), CONCAT(@next_date, ' 15:00:00'),
               320, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LIM' AND dst.iata_code='MAD';

        -- FL-023: DXB→CDG intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 08:00:00'), CONCAT(@dep_date, ' 12:00:00'),
               380, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='DXB' AND dst.iata_code='CDG';

        -- FL-024: SYD→SIN intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 10:00:00'), CONCAT(@dep_date, ' 17:00:00'),
               300, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='SYD' AND dst.iata_code='SIN';

        -- FL-025: SIN→DXB intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 01:00:00'), CONCAT(@dep_date, ' 05:00:00'),
               360, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='SIN' AND dst.iata_code='DXB';

        -- FL-026: MAD→GRU intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 14:00:00'), CONCAT(@dep_date, ' 22:00:00'),
               350, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MAD' AND dst.iata_code='GRU';

        -- FL-027: MIA→JFK intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 16:00:00'), CONCAT(@dep_date, ' 19:00:00'),
               280, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MIA' AND dst.iata_code='JFK';

        -- FL-028: FRA→LHR intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 09:00:00'), CONCAT(@dep_date, ' 10:00:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='FRA' AND dst.iata_code='LHR';

        -- FL-029: LHR→FRA intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 12:00:00'), CONCAT(@dep_date, ' 14:00:00'),
               220, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='LHR' AND dst.iata_code='FRA';

        -- FL-030: ICN→SYD intercontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 11:00:00'), CONCAT(@dep_date, ' 22:00:00'),
               300, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='ICN' AND dst.iata_code='SYD';

        -- FL-031: EZE→GRU intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 07:00:00'), CONCAT(@dep_date, ' 09:30:00'),
               180, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='EZE' AND dst.iata_code='GRU';

        -- FL-032: BOG→MIA intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 13:00:00'), CONCAT(@dep_date, ' 17:00:00'),
               230, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='BOG' AND dst.iata_code='MIA';

        -- FL-033: MEX→LAX intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 09:00:00'), CONCAT(@dep_date, ' 11:30:00'),
               240, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MEX' AND dst.iata_code='LAX';

        -- FL-034: NRT→ICN intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 14:00:00'), CONCAT(@dep_date, ' 16:00:00'),
               200, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='NRT' AND dst.iata_code='ICN';

        -- FL-035: MXP→FRA intracontinental
        INSERT INTO flights (origin_airport_id, destination_airport_id, departure_time, arrival_time, baggage_capacity, frequency, status)
        SELECT o.id, dst.id,
               CONCAT(@dep_date, ' 11:00:00'), CONCAT(@dep_date, ' 13:00:00'),
               160, 'DAILY', 'SCHEDULED'
        FROM airports o, airports dst WHERE o.iata_code='MXP' AND dst.iata_code='FRA';

        SET d = d + 1;
    END WHILE;
END$$
DELIMITER ;

CALL gen_flights();
DROP PROCEDURE IF EXISTS gen_flights;

-- 30 lotes de maletas iniciales (mezcla de estados)
INSERT INTO baggage_batches (airline_id, origin_airport_id, destination_airport_id, quantity, status, available_from, notes)
SELECT a.id, o.id, d.id, qty, status, avail, notes FROM (
    SELECT 1 AS aid, 'JFK' AS orig, 'CDG' AS dest, 120 AS qty, 'IN_ORIGIN' AS status, '2026-05-10 06:00:00' AS avail, 'Lote AA JFK-CDG' AS notes UNION ALL
    SELECT 2, 'LIM', 'GRU', 80,  'IN_ORIGIN',  '2026-05-10 05:00:00', 'Lote LA LIM-GRU'  UNION ALL
    SELECT 3, 'MAD', 'LHR', 60,  'IN_ORIGIN',  '2026-05-10 09:00:00', 'Lote IB MAD-LHR'  UNION ALL
    SELECT 4, 'MIA', 'LIM', 100, 'IN_ORIGIN',  '2026-05-10 06:30:00', 'Lote UA MIA-LIM'  UNION ALL
    SELECT 5, 'FRA', 'DXB', 150, 'IN_ORIGIN',  '2026-05-10 05:30:00', 'Lote LH FRA-DXB'  UNION ALL
    SELECT 1, 'CDG', 'NRT', 90,  'IN_ORIGIN',  '2026-05-10 11:00:00', 'Lote AA CDG-NRT'  UNION ALL
    SELECT 2, 'GRU', 'MIA', 110, 'IN_ORIGIN',  '2026-05-10 21:00:00', 'Lote LA GRU-MIA'  UNION ALL
    SELECT 3, 'LHR', 'JFK', 130, 'IN_ORIGIN',  '2026-05-10 10:30:00', 'Lote IB LHR-JFK'  UNION ALL
    SELECT 4, 'NRT', 'SIN', 70,  'IN_ORIGIN',  '2026-05-10 08:30:00', 'Lote UA NRT-SIN'  UNION ALL
    SELECT 5, 'DXB', 'CDG', 200, 'IN_ORIGIN',  '2026-05-10 07:30:00', 'Lote LH DXB-CDG'  UNION ALL
    SELECT 1, 'BOG', 'LIM', 50,  'IN_ORIGIN',  '2026-05-10 08:30:00', 'Lote AA BOG-LIM'  UNION ALL
    SELECT 2, 'SCL', 'EZE', 40,  'IN_ORIGIN',  '2026-05-10 10:30:00', 'Lote LA SCL-EZE'  UNION ALL
    SELECT 3, 'MEX', 'MIA', 75,  'IN_ORIGIN',  '2026-05-10 09:30:00', 'Lote IB MEX-MIA'  UNION ALL
    SELECT 4, 'LAX', 'JFK', 95,  'IN_ORIGIN',  '2026-05-10 06:30:00', 'Lote UA LAX-JFK'  UNION ALL
    SELECT 5, 'YYZ', 'LAX', 60,  'IN_ORIGIN',  '2026-05-10 07:30:00', 'Lote LH YYZ-LAX'  UNION ALL
    SELECT 1, 'SIN', 'ICN', 85,  'IN_ORIGIN',  '2026-05-10 14:30:00', 'Lote AA SIN-ICN'  UNION ALL
    SELECT 2, 'ICN', 'NRT', 55,  'IN_ORIGIN',  '2026-05-10 07:30:00', 'Lote LA ICN-NRT'  UNION ALL
    SELECT 3, 'MXP', 'CDG', 65,  'IN_ORIGIN',  '2026-05-10 06:30:00', 'Lote IB MXP-CDG'  UNION ALL
    SELECT 4, 'SYD', 'SIN', 120, 'IN_ORIGIN',  '2026-05-10 09:30:00', 'Lote UA SYD-SIN'  UNION ALL
    SELECT 5, 'EZE', 'GRU', 45,  'IN_ORIGIN',  '2026-05-10 06:30:00', 'Lote LH EZE-GRU'  UNION ALL
    SELECT 1, 'JFK', 'LIM', 80,  'IN_ORIGIN',  '2026-05-11 06:00:00', 'Lote AA JFK-LIM dia2' UNION ALL
    SELECT 2, 'LIM', 'MAD', 100, 'IN_ORIGIN',  '2026-05-11 22:30:00', 'Lote LA LIM-MAD dia2' UNION ALL
    SELECT 3, 'MAD', 'GRU', 140, 'IN_ORIGIN',  '2026-05-11 13:30:00', 'Lote IB MAD-GRU dia2' UNION ALL
    SELECT 4, 'MIA', 'JFK', 90,  'IN_ORIGIN',  '2026-05-11 15:30:00', 'Lote UA MIA-JFK dia2' UNION ALL
    SELECT 5, 'FRA', 'LHR', 70,  'IN_ORIGIN',  '2026-05-11 08:30:00', 'Lote LH FRA-LHR dia2' UNION ALL
    SELECT 1, 'BOG', 'MIA', 60,  'IN_ORIGIN',  '2026-05-12 12:30:00', 'Lote AA BOG-MIA dia3' UNION ALL
    SELECT 2, 'ICN', 'SYD', 110, 'IN_ORIGIN',  '2026-05-12 10:30:00', 'Lote LA ICN-SYD dia3' UNION ALL
    SELECT 3, 'NRT', 'ICN', 50,  'IN_ORIGIN',  '2026-05-12 13:30:00', 'Lote IB NRT-ICN dia3' UNION ALL
    SELECT 4, 'MEX', 'LAX', 75,  'IN_ORIGIN',  '2026-05-12 08:30:00', 'Lote UA MEX-LAX dia3' UNION ALL
    SELECT 5, 'CDG', 'FRA', 90,  'IN_ORIGIN',  '2026-05-12 15:30:00', 'Lote LH CDG-FRA dia3'
) AS data
JOIN airlines a ON a.id = data.aid
JOIN airports o ON o.iata_code = data.orig
JOIN airports d ON d.iata_code = data.dest;
