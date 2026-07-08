-- ============================================================
-- OPS_SHIPMENT - El campo client_code pasa de ser un código corto
-- a un campo de texto libre para el nombre del cliente, ingresado
-- manualmente al registrar el envío.
-- ============================================================

ALTER TABLE OPS_SHIPMENT
    MODIFY COLUMN client_code VARCHAR(100) NULL;
