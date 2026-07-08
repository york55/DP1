import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'

/**
 * FlightRoute — renders the dashed polyline for a flight, always showing
 * the full route from origin to destination.
 */
function FlightRoute({ flight, airportsByCode, isCancelled = false }) {
  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null

    return [[originAirport.lat, originAirport.lon], [destAirport.lat, destAirport.lon]]
  }, [originAirport, destAirport])

  if (!positions) return null

  const isInFlight = flight.status === 'IN_FLIGHT'

  const pathOptions = isCancelled
    ? { color: '#C62828', weight: 0.6, opacity: 0.5, dashArray: '3 5' }
    : {
        color: isInFlight ? '#0800fbff' : '#2E75B6',
        weight: isInFlight ? 0.5 : 0.4,
        opacity: isInFlight ? 0.6 : 0.2,
        dashArray: isInFlight ? '8 6' : '4 6',
      }

  return <Polyline positions={positions} pathOptions={pathOptions} />
}

export default React.memo(FlightRoute)
