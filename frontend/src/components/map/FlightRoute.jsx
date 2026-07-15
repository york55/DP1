import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import { useSimulationContext } from '../../context/SimulationContext'

/**
 * FlightRoute — renders the dashed polyline for a flight.
 *
 * - Always draws the full origin → destination route, regardless of the
 *   plane's progress (the traveled stretch is never trimmed).
 * - When a flight is selected (selectedFlightId in context) this route is
 *   drawn bold/opaque if it's the selected one, or dimmed if it's another.
 */
function FlightRoute({ flight, airportsByCode, isCancelled = false }) {
  let context = null
  try { context = useSimulationContext() } catch (e) { /* standalone mode */ }
  const selectedFlightId = context?.selectedFlightId ?? null

  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const isInFlight = flight.status === 'IN_FLIGHT'
  const isSelected = selectedFlightId != null && String(selectedFlightId) === String(flight.id)
  const isDimmed = selectedFlightId != null && !isSelected

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null
    return [[originAirport.lat, originAirport.lon], [destAirport.lat, destAirport.lon]]
  }, [originAirport, destAirport])

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