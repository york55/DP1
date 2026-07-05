import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'

/**
 * FlightRoute — renders the dashed polyline for a flight, always showing
 * the full route from origin to destination.
 */
function FlightRoute({ flight, airportsByCode }) {
  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null

    return [[originAirport.lat, originAirport.lon], [destAirport.lat, destAirport.lon]]
  }, [originAirport, destAirport])

  if (!positions) return null

  const isInFlight = flight.status === 'IN_FLIGHT'

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: isInFlight ? '#0800fbff' : '#2E75B6',
        weight: isInFlight ? 0.5 : 0.4,
        opacity: isInFlight ? 0.6 : 0.2,
        dashArray: isInFlight ? '8 6' : '4 6',
      }}
    />
  )
}

export default React.memo(FlightRoute)
