import React, { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import L from 'leaflet'

function lerp(a, b, t) { return a + (b - a) * t }

/**
 * FlightRoute — renders the dashed polyline for a flight.
 * For IN_FLIGHT flights, only the remaining segment (plane → destination) is drawn,
 * so the trail behind the plane disappears as it advances.
 */
function FlightRoute({ flight, airportsByCode, simulatedTime }) {
  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  const positions = useMemo(() => {
    if (!originAirport || !destAirport) return null

    const dest = [destAirport.lat, destAirport.lon]

    if (flight.status === 'IN_FLIGHT' && simulatedTime && flight.departureUTC && flight.arrivalUTC) {
      const dep = new Date(flight.departureUTC).getTime()
      const arr = new Date(flight.arrivalUTC).getTime()
      const now = simulatedTime instanceof Date ? simulatedTime.getTime() : new Date(simulatedTime).getTime()
      if (arr > dep) {
        const progress = Math.max(0, Math.min(1, (now - dep) / (arr - dep)))
        const p1 = L.Projection.SphericalMercator.project({ lat: originAirport.lat, lng: originAirport.lon })
        const p2 = L.Projection.SphericalMercator.project({ lat: destAirport.lat, lng: destAirport.lon })
        const ll = L.Projection.SphericalMercator.unproject({
          x: lerp(p1.x, p2.x, progress),
          y: lerp(p1.y, p2.y, progress),
        })
        return [[ll.lat, ll.lng], dest]
      }
    }

    return [[originAirport.lat, originAirport.lon], dest]
  }, [originAirport, destAirport, flight, simulatedTime])

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
