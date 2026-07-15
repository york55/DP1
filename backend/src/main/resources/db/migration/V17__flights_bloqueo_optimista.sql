-- Bloqueo optimista para vuelos: evita que una cancelación manual y un tick de la
-- simulación pisen sus escrituras entre sí (p. ej. cancelar un vuelo que acaba de
-- despegar en un tick concurrente).
ALTER TABLE flights ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
