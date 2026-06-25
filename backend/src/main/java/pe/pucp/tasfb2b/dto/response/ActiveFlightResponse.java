package pe.pucp.tasfb2b.dto.response;

public record ActiveFlightResponse(

        Long id,

        String origin,
        String destination,

        String departureUtc,
        String arrivalUtc,

        String departureLocal,
        String arrivalLocal,

        int capacity,

        boolean cancelled,

        // ── AGREGADO: true si la instancia concreta que se cancelaría ahora
        // (hoy o mañana según la regla de 1h) ya está cancelada.
        // El front usa esto para deshabilitar el botón de cancelar.
        boolean nextInstanceCancelled
) {}