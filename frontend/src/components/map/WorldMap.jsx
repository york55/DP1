import { useMemo, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import Box from '@mui/material/Box'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import PlaneCanvasLayer from './PlaneCanvasLayer'
import MapLegend from './MapLegend'
import { useSimulationContext } from '../../context/SimulationContext'
import { initPlaneIcons } from './planeIcon'
import { initWarehouseIcons } from './warehouseIcons'

function MapFocusController() {
  const map = useMap()
  const lastCenteredAirport = useRef(null)
  const lastCenteredFlight = useRef(null)
  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  if (!context) return null

  const { selectedAirportCode, selectedFlightId, airportsWithTimes, flights } = context

  useEffect(() => {
    if (!selectedAirportCode) {
      lastCenteredAirport.current = null
      return
    }
    if (selectedAirportCode === lastCenteredAirport.current) return
    const ap = airportsWithTimes.find(a => (a.iata || a.iataCode) === selectedAirportCode)
    if (ap && ap.lat != null && ap.lon != null) {
      lastCenteredAirport.current = selectedAirportCode
      map.setView([ap.lat, ap.lon], 5)
    }
  }, [selectedAirportCode, airportsWithTimes, map])

  useEffect(() => {
    if (!selectedFlightId) {
      lastCenteredFlight.current = null
      return
    }
    if (selectedFlightId === lastCenteredFlight.current) return
    const fl = flights.find(f => String(f.id) === String(selectedFlightId))
    if (fl) {
      const orig = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.origin)
      const dest = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.destination)
      if (orig && dest) {
        lastCenteredFlight.current = selectedFlightId
        map.setView([(orig.lat + dest.lat) / 2, (orig.lon + dest.lon) / 2], 4)
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
 * @param {Array} staticAirports - when provided, overrides context/props airports (e.g. config page preview)
 * @param {Date|null} simulatedTime - current simulated time for progress calculation
 * @param {*} resizeTrigger - any value whose change signals a container resize
 */
function WorldMap({ airports: propsAirports = [], flights: propsFlights = [], staticAirports, resizeTrigger }) {
  // Rasterize icons once on mount. When both resolve, bump iconsVersion so all
  // children re-render once and pick up the PNG L.icon instead of the divIcon fallback.
  const [iconsVersion, setIconsVersion] = useState(0)
  useEffect(() => {
    Promise.all([initPlaneIcons(), initWarehouseIcons()]).then(() => setIconsVersion(1))
  }, [])

  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }

  const airports = staticAirports ?? (context ? context.filteredAirports : propsAirports)
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
        center={[15, 0]}
        zoom={3.24}
        zoomSnap={0.1}
        zoomDelta={0.5}
        minZoom={3}
        maxZoom={4.5}
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

        {/* Flight route polylines */}
        {visibleFlights.map(flight => (
          <FlightRoute
            key={flight.id}
            flight={flight}
            airportsByCode={airportsByCode}
          />
        ))}

        {/* Plane icons — single canvas layer, zero DOM nodes per plane */}
        <PlaneCanvasLayer
          flights={visibleFlights}
          airportsByCode={airportsByCode}
        />

        {/* Airport markers */}
        {airports.map(airport => {
          const counts = flightCountsByAirport.get(airport.iata) || { incoming: 0, outgoing: 0 }
          return (
            <AirportMarker
              key={airport.iata}
              airport={airport}
              incomingCount={counts.incoming}
              outgoingCount={counts.outgoing}
              iconsVersion={iconsVersion}
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
