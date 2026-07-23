-- V18: ubicación actual del envío
--
-- Motivación: OPS_SHIPMENT solo guardaba origin_iata (origen ORIGINAL,
-- estático) y dest_iata (destino final). Para envíos con conexión
-- (ej. Argentina -> Colombia -> Siria), al aterrizar el primer tramo el
-- sistema no tenía forma de saber que el envío ya no está en Argentina,
-- así que cualquier replanificación (por cancelación de un tramo
-- posterior, o por el bug de OpsFlightStatusService.markShipmentsDelivered
-- que cierra el envío en el primer aterrizaje) partía siempre del origen
-- original.
--
-- current_iata / current_since_utc dejan al envío "anclado" al aeropuerto
-- donde está físicamente parado ahora mismo. NULL = sigue en su origin_iata
-- original (todavía no voló ningún tramo).

ALTER TABLE OPS_SHIPMENT
    ADD COLUMN current_iata CHAR(4) NULL AFTER dest_iata,
    ADD COLUMN current_since_utc TIMESTAMP NULL AFTER current_iata;

ALTER TABLE OPS_SHIPMENT
    ADD CONSTRAINT fk_shipment_current_airport
        FOREIGN KEY (current_iata)
        REFERENCES OPS_AIRPORT(iata_code);

CREATE INDEX idx_ops_shipment_current_iata
    ON OPS_SHIPMENT(current_iata);

-- Backfill: los envíos existentes que ya están en tránsito/entregados no
-- tienen forma retroactiva de saber su ubicación real intermedia, así que
-- se dejan en NULL (equivalente a "sigue en origin_iata") salvo los que ya
-- están DELIVERED, que quedan anclados a su destino final para consistencia.
UPDATE OPS_SHIPMENT
SET current_iata = dest_iata,
    current_since_utc = last_updated
WHERE status = 'DELIVERED';
