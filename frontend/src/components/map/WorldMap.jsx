import { useMemo, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import FlightMapPopup from './FlightMapPopup'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import PlaneCanvasLayer from './PlaneCanvasLayer'
import MapLegend from './MapLegend'
import MapFilterPanel from './MapFilterPanel'
import SimPipelineBox, { SHOW_SIM_PIPELINE } from './SimPipelineBox'
import AirportMapPopup from './AirportMapPopup'
import { useSimulationContext } from '../../context/SimulationContext'
import { initPlaneIcons } from './planeIcon'
import { initWarehouseIcons } from './warehouseIcons'

const EMPTY_FILTERS = {
  flightSemaphore: new Set(),
  flightStatus: new Set(),
  warehouseSemaphore: new Set(),
  warehouseRegion: new Set(),
}

function getFlightSemaphoreKey(pct) {
  if (pct < 25) return 'green'
  if (pct < 50) return 'yellow'
  if (pct < 75) return 'orange'
  if (pct < 90) return 'deepOrange'
  return 'red'
}

function getAirportSemaphoreKey(pct) {
  return getFlightSemaphoreKey(pct)
}

function MapFocusController({ standalone }) {
  const map = useMap()
  const lastCenteredAirport = useRef(null)
  const lastCenteredFlight = useRef(null)
  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  if (!context || standalone) return null

  const { selectedAirportCode, selectedFlightId, airportsWithTimes, flights, simulationState } = context

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
    if (!fl) return
    const orig = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.origin)
    const dest = airportsWithTimes.find(a => (a.iata || a.iataCode) === fl.destination)
    if (!orig || !dest) return
    lastCenteredFlight.current = selectedFlightId

    // For in-flight planes: interpolate actual current position in Mercator space
    if (fl.status === 'IN_FLIGHT' && fl.departureUTC && fl.arrivalUTC && simulationState?.simulatedTime) {
      const dep = new Date(fl.departureUTC).getTime()
      const arr = new Date(fl.arrivalUTC).getTime()
      const now = new Date(simulationState.simulatedTime).getTime()
      if (arr > dep) {
        const t = Math.max(0, Math.min(1, (now - dep) / (arr - dep)))
        const p1 = L.Projection.SphericalMercator.project({ lat: orig.lat, lng: orig.lon })
        const p2 = L.Projection.SphericalMercator.project({ lat: dest.lat, lng: dest.lon })
        const ll = L.Projection.SphericalMercator.unproject({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        })
        map.panTo([ll.lat, ll.lng])
        return
      }
    }
    // Fallback (SCHEDULED / no time data): center between airports
    map.setView([(orig.lat + dest.lat) / 2, (orig.lon + dest.lon) / 2], 4)
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

// Updates the airport popup overlay position imperatively on pan/zoom.
function MapAirportTracker({ airport, popupRef }) {
  const map = useMap()
  useEffect(() => {
    if (!airport) return
    function update() {
      const el = popupRef.current
      if (!el) return
      const pt = map.latLngToContainerPoint([airport.lat, airport.lon])
      el.style.left = pt.x + 'px'
      el.style.top = pt.y + 'px'
    }
    map.on('move zoom moveend zoomend viewreset', update)
    return () => map.off('move zoom moveend zoomend viewreset', update)
  }, [map, airport, popupRef])
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
function WorldMap({ airports: propsAirports = [], flights: propsFlights = [], staticAirports, resizeTrigger, standalone = false, simulatedTime: propsSimulatedTime = null, animClockRef: propsAnimClockRef = null }) {
  // Rasterize icons once on mount. When both resolve, bump iconsVersion so all
  // children re-render once and pick up the PNG L.icon instead of the divIcon fallback.
  const [iconsVersion, setIconsVersion] = useState(0)
  useEffect(() => {
    Promise.all([initPlaneIcons(), initWarehouseIcons()]).then(() => setIconsVersion(1))
  }, [])

  const [mapFilters, setMapFilters] = useState(EMPTY_FILTERS)

  // Plane click overlay — rendered outside MapContainer so it sits above the canvas
  const [activePlane, setActivePlane] = useState(null) // { flight, x, y }
  const planePopupRef = useRef(null)
  const activePlaneFlightId = activePlane?.flight?.id ?? null

  // Airport click overlay — same pattern, static position tracked on pan/zoom
  const [activeAirport, setActiveAirport] = useState(null) // { airport, semaphore, incomingCount, outgoingCount, x, y }
  const airportPopupRef = useRef(null)

  // Mutual-exclusion handlers: opening one popup closes the other
  function handlePlaneClick(data) {
    setActivePlane(data)
    if (data) setActiveAirport(null)
  }
  function handleAirportSelect(data) {
    setActiveAirport(data)
    if (data) setActivePlane(null)
  }

  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }

  const baseAirports = staticAirports ?? ((context && !standalone) ? context.filteredAirports : propsAirports)
  const baseFlights = (context && !standalone) ? context.filteredFlights : propsFlights
  const simulatedTime = standalone ? propsSimulatedTime : (context?.simulationState?.simulatedTime ?? propsSimulatedTime)
  const animClockRef = standalone ? propsAnimClockRef : (context?.animClockRef ?? propsAnimClockRef)
  const planningProgress = context?.planningProgress ?? { phase: '', iteration: 0, maxIterations: 1000, assignedBatches: 0, totalBatches: 0, currentObjective: 0 }
  const blockHistory = context?.blockHistory ?? []
  const totalSimBlocks = context?.totalSimBlocks ?? 0

  // Unique continent values for region chips — derived from live airport data.
  // 'unknown' from the DB is normalized to 'Sudamérica' (matches useSimulation patch).
  const normalizeContinent = (c) =>
    (!c || c.toLowerCase() === 'unknown') ? 'Sudamérica' : c

  const regionOptions = useMemo(() =>
    [...new Set(baseAirports.map(a => normalizeContinent(a.continent)).filter(Boolean))].sort()
  , [baseAirports])

  // Apply local map filters on top of context/sidebar filters
  const airports = useMemo(() => {
    const { warehouseSemaphore, warehouseRegion } = mapFilters
    if (!warehouseSemaphore.size && !warehouseRegion.size) return baseAirports
    return baseAirports.filter(a => {
      if (warehouseSemaphore.size && !warehouseSemaphore.has(getAirportSemaphoreKey(a.occupancy ?? 0))) return false
      if (warehouseRegion.size && !warehouseRegion.has(normalizeContinent(a.continent))) return false
      return true
    })
  }, [baseAirports, mapFilters])

  const flights = useMemo(() => {
    const { flightSemaphore, flightStatus } = mapFilters
    if (!flightSemaphore.size && !flightStatus.size) return baseFlights
    return baseFlights.filter(f => {
      if (flightStatus.size && !flightStatus.has(f.status)) return false
      if (flightSemaphore.size) {
        const pct = ((f.bagsAboard || 0) / (f.capacity || 1)) * 100
        if (!flightSemaphore.has(getFlightSemaphoreKey(pct))) return false
      }
      return true
    })
  }, [baseFlights, mapFilters])

  const activeFilterCount =
    mapFilters.flightSemaphore.size +
    mapFilters.flightStatus.size +
    mapFilters.warehouseSemaphore.size +
    mapFilters.warehouseRegion.size

  // Plane canvas + routes only render IN_FLIGHT entries
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
    for (const f of baseFlights) {
      if (f.status !== 'SCHEDULED' && f.status !== 'IN_FLIGHT') continue
      get(f.destination).incoming += 1
      get(f.origin).outgoing += 1
    }
    return map
  }, [baseFlights])

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
        <MapFocusController standalone={standalone} />

        {/* Flight route polylines — trimmed to remaining segment for IN_FLIGHT */}
        {visibleFlights.map(flight => (
          <FlightRoute
            key={flight.id}
            flight={flight}
            airportsByCode={airportsByCode}
            simulatedTime={simulatedTime}
          />
        ))}

        {/* Plane icons — single canvas layer, zero DOM nodes per plane */}
        <PlaneCanvasLayer
          flights={visibleFlights}
          airportsByCode={airportsByCode}
          onPlaneClick={handlePlaneClick}
          planePopupRef={planePopupRef}
          activePlaneFlightId={activePlaneFlightId}
          animClockRefOverride={animClockRef}
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
              onSelect={handleAirportSelect}
            />
          )
        })}

        {/* Tracks active airport position on pan/zoom — updates overlay imperatively */}
        <MapAirportTracker airport={activeAirport?.airport ?? null} popupRef={airportPopupRef} />
      </MapContainer>

      {/* Legend (absolute positioned over map) */}
      <MapLegend />

      {/* Quick-filter panel (absolute positioned over map, top-right) */}
      <MapFilterPanel
        filters={mapFilters}
        onChange={setMapFilters}
        activeCount={activeFilterCount}
        regionOptions={regionOptions}
      />

      {/* ALNS pipeline box — disable by setting SHOW_SIM_PIPELINE=false in SimPipelineBox.jsx */}
      {SHOW_SIM_PIPELINE && (
        <SimPipelineBox
          planningProgress={planningProgress}
          blockHistory={blockHistory}
          totalSimBlocks={totalSimBlocks}
          simulatedTime={simulatedTime}
        />
      )}

      {/* Airport click popup — outside MapContainer, above canvas z-index */}
      {activeAirport && (
        <Paper
          ref={airportPopupRef}
          elevation={6}
          style={{
            position: 'absolute',
            left: activeAirport.x,
            top: activeAirport.y,
            zIndex: 1200,
            transform: 'translate(-50%, calc(-100% - 14px))',
            pointerEvents: 'auto',
          }}
          sx={{ p: '8px 10px', borderRadius: 1.5, position: 'relative' }}
        >
          <IconButton
            size="small"
            onClick={() => setActiveAirport(null)}
            sx={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, color: '#9E9E9E', '&:hover': { color: '#333' } }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <AirportMapPopup
            airport={activeAirport.airport}
            semaphore={activeAirport.semaphore}
            incomingCount={activeAirport.incomingCount}
            outgoingCount={activeAirport.outgoingCount}
          />
        </Paper>
      )}

      {/* Plane click popup — rendered outside MapContainer so z-index beats the canvas.
          Position is set as inline style (initial from click, then updated by rAF). */}
      {activePlane && (
        <Paper
          ref={planePopupRef}
          elevation={6}
          style={{
            position: 'absolute',
            left: activePlane.x,
            top: activePlane.y,
            zIndex: 1200,
            transform: 'translate(-50%, calc(-100% - 14px))',
            pointerEvents: 'auto',
          }}
          sx={{ p: '8px 10px', borderRadius: 1.5, minWidth: 190, maxWidth: 220, position: 'relative' }}
        >
          <IconButton
            size="small"
            onClick={() => setActivePlane(null)}
            sx={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, color: '#9E9E9E', '&:hover': { color: '#333' } }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <FlightMapPopup flight={activePlane.flight} />
        </Paper>
      )}
    </Box>
  )
}

export default WorldMap