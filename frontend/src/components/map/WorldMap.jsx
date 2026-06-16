import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import Box from '@mui/material/Box'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import MapLegend from './MapLegend'
import { useSimulationContext } from '../../context/SimulationContext'

function MapFocusController() {
  const map = useMap()
  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  if (!context) return null

  const { selectedAirportCode, selectedFlightId, airportsWithTimes, flights } = context

  useEffect(() => {
    if (selectedAirportCode) {
      const ap = airportsWithTimes.find(a => (a.iata || a.iataCode) === selectedAirportCode)
      if (ap && ap.lat != null && ap.lon != null) {
        map.setView([ap.lat, ap.lon], 5)
      }
    }
  }, [selectedAirportCode, airportsWithTimes, map])

  useEffect(() => {
    if (selectedFlightId) {
      const fl = flights.find(f => String(f.id) === String(selectedFlightId))
      if (fl) {
        const orig = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.origin)
        const dest = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.destination)
        if (orig && dest) {
          const lat = (orig.lat + dest.lat) / 2
          const lon = (orig.lon + dest.lon) / 2
          map.setView([lat, lon], 4)
        }
      }
    }
  }, [selectedFlightId, flights, airportsWithTimes, map])

  return null
}


function MapResizer({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [trigger, map])
  return null
}

// Creates a custom Leaflet pane for airport markers so they always render
// above flight route polylines (overlayPane z-index is 400; airports get 450).
function AirportPaneSetup() {
  const map = useMap()
  useEffect(() => {
    if (!map.getPane('airportPane')) {
      const pane = map.createPane('airportPane')
      pane.style.zIndex = 450
      // Pane is SVG-based — pointer events must be enabled explicitly
      pane.style.pointerEvents = 'auto'
    }
  }, [map])
  return null
}

/**
 * WorldMap — renders the full interactive world map with airports and flight routes.
 * @param {Array} airports - array of airport objects (with live occupancy)
 * @param {Array} flights - array of flight objects
 * @param {Date|null} simulatedTime - current simulated time for progress calculation
 * @param {*} resizeTrigger - any value whose change signals a container resize
 */
function WorldMap({ airports: propsAirports = [], flights: propsFlights = [], simulatedTime = null, resizeTrigger }) {
  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }

  const airports = context ? context.filteredAirports : propsAirports
  const flights = context ? context.filteredFlights : propsFlights

  // Show all IN_FLIGHT flights with valid airport assignments.
  const visibleFlights = useMemo(() =>
    flights.filter(f => f.status === 'IN_FLIGHT'),
    [flights]
  )

  // O(1) airport lookups instead of each FlightRoute/marker doing its own
  // Array.find() over the full airports list on every render.
  const airportsByCode = useMemo(() => {
    const map = new Map()
    for (const a of airports) map.set(a.iata || a.iataCode, a)
    return map
  }, [airports])

  // Single O(flights) pass to count incoming/outgoing per airport, instead of
  // every AirportMarker filtering the full flights array on its own.
  const flightCountsByAirport = useMemo(() => {
    const map = new Map()
    const get = (code) => {
      let entry = map.get(code)
      if (!entry) {
        entry = { incoming: 0, outgoing: 0 }
        map.set(code, entry)
      }
      return entry
    }
    for (const f of flights) {
      if (f.status !== 'SCHEDULED' && f.status !== 'IN_FLIGHT') continue
      get(f.destination).incoming += 1
      get(f.origin).outgoing += 1
    }
    return map
  }, [flights])

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[20, 0]}
        zoom={3}
        minZoom={2}
        maxBounds={[[-85.051129, -180], [85.051129, 180]]}
        maxBoundsViscosity={1.0}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          noWrap={true}
        />
        <MapResizer trigger={resizeTrigger} />
        <AirportPaneSetup />
        <MapFocusController />

        {/* Flight routes and Planes */}
        {visibleFlights.map(flight => (
          <FlightRoute
            key={flight.id}
            flight={flight}
            airportsByCode={airportsByCode}
            simulatedTime={simulatedTime}
          />
        ))}

        {/* Airport markers */}
        {airports.map(airport => {
          const counts = flightCountsByAirport.get(airport.iata) || { incoming: 0, outgoing: 0 }
          return (
            <AirportMarker
              key={airport.iata}
              airport={airport}
              incomingCount={counts.incoming}
              outgoingCount={counts.outgoing}
            />
          )
        })}
      </MapContainer>

      {/* Legend (absolute positioned over map) */}
      <MapLegend />
    </Box>
  )
}

export default WorldMap
