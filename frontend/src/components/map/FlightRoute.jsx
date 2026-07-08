import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useSimulationContext } from '../../context/SimulationContext'

// Same progress source PlaneCanvasLayer uses: prefer the backend-provided
// `progress` field (0-1) from the tick event, fall back to time interpolation.
function getProgress(flight, simulatedTime) {
  if (typeof flight.progress === 'number') {
    return Math.max(0, Math.min(1, flight.progress))
  }
  if (simulatedTime && flight.departureUTC && flight.arrivalUTC) {
    const dep = new Date(flight.departureUTC).getTime()
    const arr = new Date(flight.arrivalUTC).getTime()
    const now = simulatedTime instanceof Date ? simulatedTime.getTime() : new Date(simulatedTime).getTime()
    if (arr > dep) return Math.max(0, Math.min(1, (now - dep) / (arr - dep)))
  }
  return 0
}

/**
 * FlightRoute — renders the dashed polyline for a flight.
 *
 * - SCHEDULED: full origin → destination line (plane hasn't departed yet).
 * - IN_FLIGHT: only the *remaining* stretch is drawn (current position →
 *   destination), so the traveled part disappears as the plane advances.
 *   The current position is interpolated the same way (Spherical Mercator)
 *   PlaneCanvasLayer interpolates the plane icon, so both stay in sync.
 * - When a flight is selected (selectedFlightId in context) this route is
 *   drawn bold/opaque if it's the selected one, or dimmed if it's another.
 */
function FlightRoute({ flight, airportsByCode, isCancelled = false }) {
  let context = null
  try { context = useSimulationContext() } catch (e) { /* standalone mode */ }
  const simulatedTime = context?.simulationState?.simulatedTime ?? null
  const selectedFlightId = context?.selectedFlightId ?? null

  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const isInFlight = flight.status === 'IN_FLIGHT'
  const isSelected = selectedFlightId != null && String(selectedFlightId) === String(flight.id)
  const isDimmed = selectedFlightId != null && !isSelected

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null

    if (isInFlight) {
      const progress = getProgress(flight, simulatedTime)
      const p1 = L.Projection.SphericalMercator.project({ lat: originAirport.lat, lng: originAirport.lon })
      const p2 = L.Projection.SphericalMercator.project({ lat: destAirport.lat, lng: destAirport.lon })
      const ll = L.Projection.SphericalMercator.unproject({
        x: p1.x + (p2.x - p1.x) * progress,
        y: p1.y + (p2.y - p1.y) * progress,
      })
      return [[ll.lat, ll.lng], [destAirport.lat, destAirport.lon]]
    }

    return [[originAirport.lat, originAirport.lon], [destAirport.lat, destAirport.lon]]
  }, [originAirport, destAirport, isInFlight, flight, simulatedTime])

  if (!positions) return null

  const pathOptions = isCancelled
    ? { color: '#C62828', weight: 0.6, opacity: 0.5, dashArray: '3 5' }
    : {
        color: isInFlight ? '#0800fbff' : '#2E75B6',
        weight: isSelected ? 2.4 : (isInFlight ? 0.5 : 0.4),
        opacity: isDimmed ? 0.08 : (isSelected ? 0.95 : (isInFlight ? 0.6 : 0.2)),
        dashArray: isSelected ? null : (isInFlight ? '8 6' : '4 6'),
      }

  return <Polyline positions={positions} pathOptions={pathOptions} />
}

export default React.memo(FlightRoute)