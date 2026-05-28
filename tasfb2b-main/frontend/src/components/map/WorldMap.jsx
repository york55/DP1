import { useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import Box from '@mui/material/Box'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import MapLegend from './MapLegend'

// Triggers Leaflet's invalidateSize() whenever `trigger` changes, fixing gray
// zones that appear after the map's container is resized (e.g. sidebar collapse).
function MapResizer({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [trigger, map])
  return null
}

/**
 * WorldMap — renders the full interactive world map with airports and flight routes.
 * @param {Array} airports - array of airport objects (with live occupancy)
 * @param {Array} flights - array of flight objects
 * @param {Date|null} simulatedTime - current simulated time for progress calculation
 * @param {*} resizeTrigger - any value whose change signals a container resize
 */
function WorldMap({ airports = [], flights = [], simulatedTime = null, resizeTrigger }) {
  // Show IN_FLIGHT flights (route + plane icon) and SCHEDULED flights that came from
  // a tick event (route only, dashed). The fromTick flag limits display to the
  // ~50-flight tick window instead of the full 800+ DB dataset, avoiding Leaflet lag.
  const visibleFlights = useMemo(() =>
    flights.filter(f => f.status === 'IN_FLIGHT' || (f.status === 'SCHEDULED' && f.fromTick)),
    [flights]
  )

  // ─── FLIGHT DRAWING DIAGNOSTIC LOG ───────────────────────────────────────────
  // Logs every time the flights list changes. Open DevTools > Console to see it.
  const logCountRef = useRef(0)
  useEffect(() => {
    logCountRef.current += 1
    const logIndex = logCountRef.current

    // Build a quick airport lookup map by iata code for validation
    const airportMap = new Map(airports.map(a => [a.iata || a.iataCode, a]))

    // Categorise every flight
    const drawn = []
    const skipped = []

    for (const f of flights) {
      const originAirport  = airportMap.get(f.origin)
      const destAirport    = airportMap.get(f.destination)

      if (f.status !== 'IN_FLIGHT') {
        skipped.push({ id: f.id, origin: f.origin, destination: f.destination, reason: `status="${f.status}"` })
        continue
      }
      if (!originAirport) {
        skipped.push({ id: f.id, origin: f.origin, destination: f.destination, reason: `origin airport "${f.origin}" not found in airports array` })
        continue
      }
      if (!destAirport) {
        skipped.push({ id: f.id, origin: f.origin, destination: f.destination, reason: `destination airport "${f.destination}" not found in airports array` })
        continue
      }
      if (originAirport.lat == null || originAirport.lon == null) {
        skipped.push({ id: f.id, origin: f.origin, destination: f.destination, reason: `origin airport "${f.origin}" has no lat/lon` })
        continue
      }
      if (destAirport.lat == null || destAirport.lon == null) {
        skipped.push({ id: f.id, origin: f.origin, destination: f.destination, reason: `destination airport "${f.destination}" has no lat/lon` })
        continue
      }
      drawn.push({ id: f.id, origin: f.origin, destination: f.destination, progress: f.progress })
    }

    // Print the summary report
    console.group(`[WorldMap] Flight Draw Report #${logIndex} — SimTime: ${simulatedTime ? simulatedTime.toISOString() : 'null'}`)
    console.log(`📊 Total flights received: ${flights.length} | Airports loaded: ${airports.length}`)
    console.log(`✅ Drawn (IN_FLIGHT + valid airports): ${drawn.length}`)
    if (drawn.length > 0) {
      console.table(drawn)
    } else {
      console.warn('⚠️  No flights are being drawn on the map.')
    }
    console.log(`❌ Skipped: ${skipped.length}`)
    if (skipped.length > 0) {
      // Show only the first 20 skipped entries to avoid flooding the console
      console.table(skipped.slice(0, 20))
      if (skipped.length > 20) console.log(`   ... and ${skipped.length - 20} more skipped.`)
    }

    // Extra: show status breakdown of all flights
    const statusCounts = flights.reduce((acc, f) => {
      acc[f.status || 'undefined'] = (acc[f.status || 'undefined'] || 0) + 1
      return acc
    }, {})
    console.log('📋 Status breakdown:', statusCounts)
    console.groupEnd()
  }, [flights, airports, simulatedTime])
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-85.051129, -180], [85.051129, 180]]}
        maxBoundsViscosity={1.0}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          noWrap={true}
        />
        <MapResizer trigger={resizeTrigger} />

        {/* Flight routes and Planes */}
        {visibleFlights.map(flight => (
          <FlightRoute
            key={flight.id}
            flight={flight}
            airports={airports}
            simulatedTime={simulatedTime}
          />
        ))}

        {/* Airport markers */}
        {airports.map(airport => (
          <AirportMarker
            key={airport.iata}
            airport={airport}
            flights={flights}
          />
        ))}
      </MapContainer>

      {/* Legend (absolute positioned over map) */}
      <MapLegend />
    </Box>
  )
}

export default WorldMap
