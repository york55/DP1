-- V14: Poblar Clp_airports copiando los datos del catálogo maestro `airports`.
-- Se ejecuta una sola vez. Si `airports` aún está vacío en este momento
-- (porque el DataSeeder aún no corrió), el INSERT simplemente no inserta nada;
-- el ClpDataSeeder (Java) se encarga de verificar y copiar al arrancar.
-- Esta migración asegura que si airports ya fue poblada (reinicio con BD existente),
-- Clp_airports quede sincronizada de inmediato.
INSERT INTO Clp_airports (iata_code, city, country, continent, warehouse_capacity,
                          current_occupancy, gmt_offset, latitude, longitude)
SELECT iata_code, city, country, continent, warehouse_capacity,
       0, gmt_offset, latitude, longitude
FROM airports
WHERE NOT EXISTS (SELECT 1 FROM Clp_airports LIMIT 1);
