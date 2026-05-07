import React, { useMemo } from 'react'
import { Polyline, Marker } from 'react-leaflet'
import L from 'leaflet'
import { AIRPORTS } from '../../data/mockAirports'
import { getFlightProgress } from '../../utils/timeUtils'

function lerp(a, b, t) {
  return a + (b - a) * t
}

const BAGGAGE_ICON = L.divIcon({
  className: '',
  html: '<div style="font-size:18px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">🧳</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/**
 * FlightRoute — renders a Polyline for a flight route.
 * If the flight is IN_FLIGHT, renders an animated baggage icon at the progress point.
 */
export default function FlightRoute({ flight, simulatedTime }) {
  const originAirport = AIRPORTS.find(a => a.iata === flight.origin)
  const destAirport = AIRPORTS.find(a => a.iata === flight.destination)

  const isInFlight = flight.status === 'IN_FLIGHT'

  const progress = useMemo(() => {
    if (!isInFlight) return 0
    return getFlightProgress(flight.departureUTC, flight.arrivalUTC, simulatedTime)
  }, [isInFlight, flight.departureUTC, flight.arrivalUTC, simulatedTime])

  const progressPosition = useMemo(() => {
    if (!isInFlight || !originAirport || !destAirport) return null
    return [
      lerp(originAirport.lat, destAirport.lat, progress),
      lerp(originAirport.lon, destAirport.lon, progress),
    ]
  }, [isInFlight, progress, originAirport, destAirport])

  if (!originAirport || !destAirport) return null

  const positions = [
    [originAirport.lat, originAirport.lon],
    [destAirport.lat, destAirport.lon],
  ]

  const lineColor = isInFlight ? '#FB8C00' : '#2E75B6'
  const lineWeight = isInFlight ? 2.5 : 1.5
  const lineOpacity = isInFlight ? 0.9 : 0.4
  const dashArray = isInFlight ? null : '4 6'

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: lineColor,
          weight: lineWeight,
          opacity: lineOpacity,
          dashArray,
        }}
      />
      {isInFlight && progressPosition && (
        <Marker
          position={progressPosition}
          icon={BAGGAGE_ICON}
          zIndexOffset={1000}
        />
      )}
    </>
  )
}
