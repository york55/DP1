import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'

/**
 * FlightRoute — renders the dashed polyline between origin and destination.
 * Plane icons are handled separately by PlaneCanvasLayer for performance.
 */
function FlightRoute({ flight, airportsByCode }) {
  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null
    return [
      [originAirport.lat, originAirport.lon],
      [destAirport.lat, destAirport.lon],
    ]
  }, [originAirport, destAirport])

  if (!positions) return null

  const isInFlight = flight.status === 'IN_FLIGHT'

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: isInFlight ? '#FB8C00' : '#2E75B6',
        weight: isInFlight ? 0.75 : 0.6,
        opacity: isInFlight ? 0.85 : 0.4,
        dashArray: isInFlight ? '8 6' : '4 6',
      }}
    />
  )
}

export default React.memo(FlightRoute)
