import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import client from '../../api/client'
import OpsPanel from '../../components/ops/OpsPanel'
import MapLegend from '../../components/ops/MapLegend'
import { createRoot } from 'react-dom/client'
import { createReactPopup }
  from '../../utils/leafletPopup'

import AirportMapPopup
  from '../../components/map/AirportMapPopup'

import FlightMapPopup
  from '../../components/map/FlightMapPopup'

import {
  WAREHOUSE_ICONS,
  initWarehouseIcons
} from '../../components/map/warehouseIcons'

import {
  PLANE_IMAGES,
  initPlaneIcons
} from '../../components/map/planeIcon'

import { getSemaphoreColor }
  from '../../utils/semaphoreUtils'

const POLL_INTERVAL_MS = 30_000 // refresca cada 30 s

// Panel lateral: colapsable + ajustable por arrastre (mismo patrón que Simulación)
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 700
const DEFAULT_PANEL_WIDTH = 460



function airportIcon(pct) {

  return WAREHOUSE_ICONS[
    getSemaphoreColor(pct)
  ]

}

function getBearing(lat1, lon1, lat2, lon2) {

  const dLon =
    (lon2 - lon1) * Math.PI / 180

  const y =
    Math.sin(dLon) *
    Math.cos(lat2 * Math.PI / 180)

  const x =
    Math.cos(lat1 * Math.PI / 180) *
    Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.cos(dLon)

  return (
    Math.atan2(y, x) *
    180 /
    Math.PI
  )
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Camino restante por volar: desde la posición actual del avión hasta el destino,
// azul discontinuo, con opacidad decreciente hacia el destino (se va desvaneciendo
// hacia adelante, como si aún no estuviera "confirmado").
function drawFlightPath(layerGroup, L, p1, p2, tFrom, tTo, { isDimmed = false, isSelected = false } = {}) {
  const SEGMENTS = 14
  const maxOpacity = isDimmed ? 0.12 : (isSelected ? 0.75 : 0.55)

  for (let i = 0; i < SEGMENTS; i++) {
    const segStart = tFrom + ((tTo - tFrom) * i) / SEGMENTS
    const segEnd = tFrom + ((tTo - tFrom) * (i + 1)) / SEGMENTS

    const start = L.Projection.SphericalMercator.unproject({
      x: lerp(p1.x, p2.x, segStart),
      y: lerp(p1.y, p2.y, segStart),
    })
    const end = L.Projection.SphericalMercator.unproject({
      x: lerp(p1.x, p2.x, segEnd),
      y: lerp(p1.y, p2.y, segEnd),
    })

    // El segmento más cercano al avión es el más visible; se desvanece hacia el destino
    const segOpacity = maxOpacity * (1 - i / SEGMENTS)

    L.polyline(
      [[start.lat, start.lng], [end.lat, end.lng]],
      {
        color: '#2E75B6',
        weight: 2,
        opacity: segOpacity,
        dashArray: '6 6',
      }
    ).addTo(layerGroup)
  }
}

// isSelected/isDimmed permiten resaltar el vuelo enfocado y atenuar el resto,
// igual que FlightRoute.jsx en Simulación.
function flightRouteStyle(status, { isSelected = false, isDimmed = false } = {}) {

  const isInFlight =
    status === 'En vuelo' ||
    status === 'IN_FLIGHT'

  const isCancelled =
    status === 'Cancelado' ||
    status === 'CANCELLED'

  if (isCancelled) {
    return { color: '#C62828', weight: 0.6, opacity: isDimmed ? 0.05 : 0.5, dashArray: '3 5' }
  }

  if (isSelected) {
    return {
      color: isInFlight ? '#FB8C00' : '#2E75B6',
      weight: 2.6,
      opacity: 0.95,
      dashArray: null,
    }
  }

  return {

    color: isInFlight
      ? '#FB8C00'
      : '#2E75B6',

    weight: isInFlight
      ? 0.5
      : 0.4,

    opacity: isDimmed
      ? 0.06
      : (isInFlight ? 0.45 : 0.20),

    dashArray: isInFlight
      ? '8 6'
      : '4 6'

  }

}

// 'unknown' del backend se normaliza igual que en Simulación
function normalizeContinent(c) {
  return (!c || String(c).toLowerCase() === 'unknown') ? 'Sudamérica' : c
}

// Mismos umbrales que ya usaba OpsWarehousesTab para el filtro de semáforo
function occupancyBucket(pct) {
  const p = pct ?? 0
  if (p < 25) return 'LOW'
  if (p < 50) return 'MEDIUM'
  if (p < 80) return 'HIGH'
  return 'CRITICAL'
}

// Tooltip compacto al hacer hover sobre un aeropuerto
const airportTooltipHtml = (a) => `
  <div style="font-size:12.5px;line-height:1.4;">
    <div style="font-weight:600;color:#1F3864;">${a.iataCode} · ${a.name}</div>
    <div style="color:#555;">${a.country}</div>
    <div style="color:#777;margin-top:2px;">Ocupación: ${a.assignedShipments} / ${a.capacity}</div>
  </div>
`

export default function RealtimeMapPage() {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const airportLayer = useRef(null)  // LayerGroup para aeropuertos
  const flightMarkers = useRef(new Map()) // LayerGroup para aviones
  const airportMarkers =
    useRef(new Map())
  const flightLayer = useRef(null)
  const selectionLayer = useRef(null) // halo de almacén + ruta de envío seleccionado

  const [lastUpdate, setLastUpdate] = useState(null)

  // Panel: colapsado / ancho ajustable por arrastre
  const [collapsed, setCollapsed] = useState(true)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [shipments, setShipments] = useState([])

  // Metadata estática de aeropuertos (continente, etc.) — viene de /ops/airports,
  // no de /ops/map/snapshot, así que se trae una sola vez y se mezcla por iataCode.
  const [airportMeta, setAirportMeta] = useState(null)

  useEffect(() => {
    client.get('/ops/airports')
      .then(res => {
        const map = new Map()
        ;(res.data || []).forEach(a => map.set(a.iataCode, a.continent))
        setAirportMeta(map)
      })
      .catch(e => console.error('Error fetching ops/airports:', e))
  }, [])

  const [selectedFlightId, setSelectedFlightId] =
    useState(null)

  const [selectedAirportCode, setSelectedAirportCode] =
    useState(null)

  const [selectedShipmentId, setSelectedShipmentId] =
    useState(null)

  // Filtros de Almacenes — viven acá porque también acotan lo que se pinta en el mapa
  const [warehouseFilters, setWarehouseFilters] = useState({
    search: '',
    continent: 'ALL',
    semaphore: 'ALL',
  })

  // AGREGADO: filtro "solo vuelos con envíos" — controla tanto la tabla del
  // tab Vuelos como los aviones dibujados en el mapa (oculta los vacíos).
  const [onlyWithShipments, setOnlyWithShipments] = useState(false)

  // ── Foco de envío: ruta con saltos (planificado) o el vuelo actual (en tránsito) ──
  const handleShipmentFocus = useCallback((shipment) => {
    if (!shipment) {
      setSelectedShipmentId(null)
      setSelectedFlightId(null)
      return
    }

    setSelectedShipmentId(shipment.id)

    const shipmentFlights = (shipment.flightIds || [])
      .map(fid => flights.find(f => f.flightId === fid))
      .filter(Boolean)

    const activeFlight = shipmentFlights.find(
      f => f.status === 'En vuelo' || f.status === 'IN_FLIGHT'
    )

    if (activeFlight) {
      // Está en tránsito: enfocamos el avión, igual que si lo hubieran clickeado en el mapa
      setSelectedAirportCode(null)
      setSelectedFlightId(activeFlight.flightId)
      return
    }

    // Planificado (o esperando el siguiente tramo): sin vuelo activo que resaltar,
    // enfocamos el almacén relevante y dejamos que selectedShipmentRoute dibuje los saltos
    setSelectedFlightId(null)
    const code = shipment.status === 'PLANNED' ? shipment.originIata : shipment.destIata
    if (code) setSelectedAirportCode(code)
  }, [flights])

  const handleFlightFocus = useCallback((flightId) => {
    setSelectedShipmentId(null)
    setSelectedAirportCode(null)
    setSelectedFlightId(flightId)
  }, [])

  const handleAirportFocus = useCallback((code) => {
    setSelectedShipmentId(null)
    setSelectedFlightId(null)
    setSelectedAirportCode(code)
  }, [])

  // ── Tramos de la ruta de un envío seleccionado (derivados de sus flightIds) ──────
  const selectedShipmentRoute = useMemo(() => {
    if (!selectedShipmentId) return null
    const shipment = shipments.find(s => s.id === selectedShipmentId)
    if (!shipment) return null

    const legFlights = (shipment.flightIds || [])
      .map(fid => flights.find(f => f.flightId === fid))
      .filter(Boolean)

    // Si hay un tramo en vuelo, ya se resalta como vuelo seleccionado — no se dibuja línea aparte.
    if (legFlights.some(f => f.status === 'En vuelo' || f.status === 'IN_FLIGHT')) return null

    if (legFlights.length > 0) {
      return legFlights.map(f => ({ originIata: f.originIata, destIata: f.destIata }))
    }

    // Sin tramos resolubles: línea directa origen → destino como respaldo
    if (shipment.originIata && shipment.destIata) {
      return [{ originIata: shipment.originIata, destIata: shipment.destIata }]
    }
    return null
  }, [selectedShipmentId, shipments, flights])

  // ── Filtro de almacenes para el mapa (Código/Buscar, Continente, Semáforo) ────────
  const filteredAirports = useMemo(() => {
    const { search, continent, semaphore } = warehouseFilters
    return airports.filter(a => {
      if (search) {
        const s = search.toLowerCase()
        const matchesText =
          a.iataCode?.toLowerCase().includes(s) ||
          a.name?.toLowerCase().includes(s)
        if (!matchesText) return false
      }
      if (continent !== 'ALL' && normalizeContinent(a.continent) !== continent) return false
      if (semaphore !== 'ALL' && occupancyBucket(a.occupancyPct) !== semaphore) return false
      return true
    })
  }, [airports, warehouseFilters])

  // Código/Buscar solo acota almacenes; Continente y Semáforo acotan también los vuelos
  const mapFlightFilterActive =
    warehouseFilters.continent !== 'ALL' ||
    warehouseFilters.semaphore !== 'ALL'

  const filteredFlightsForMap = useMemo(() => {
    let result = flights

    if (mapFlightFilterActive) {
      const codes = new Set(filteredAirports.map(a => a.iataCode))
      result = result.filter(f => codes.has(f.originIata) || codes.has(f.destIata))
    }

    // AGREGADO: oculta del mapa los vuelos sin envíos asignados cuando el switch está activo
    if (onlyWithShipments) {
      result = result.filter(f => (f.assignedBags || 0) > 0)
    }

    return result
  }, [flights, filteredAirports, mapFlightFilterActive, onlyWithShipments])

  // ── Fetch del snapshot (solo actualiza datos; el dibujado va aparte) ─────────────

  const fetchSnapshot = useCallback(async () => {
    if (!airportMeta) return // espera a tener la metadata (continente) antes de pintar

    try {
      const res = await client.get('/ops/map/snapshot')
      const data = res.data

      const STATUS_LABEL = {
        IN_FLIGHT: 'En vuelo',
        SCHEDULED: 'Programado',
        LANDED: 'Aterrizado',
        CANCELLED: 'Cancelado',
        DELAYED: 'Demorado',
      }

      const normalizedFlights = (data.flights || []).map(f => ({
        ...f,
        status: STATUS_LABEL[f.status] ?? f.status,
      }))

      // El snapshot no trae continente — se mezcla acá con la metadata de /ops/airports
      const mergedAirports = (data.airports || []).map(a => ({
        ...a,
        continent: airportMeta.get(a.iataCode),
      }))

      setAirports(mergedAirports)
      setFlights(normalizedFlights)
      setShipments(data.shipments || [])
      setLastUpdate(new Date().toLocaleTimeString('es-PE'))
    } catch (e) {
      console.error('Error fetching ops/map/snapshot:', e)
    }
  }, [airportMeta])

  // ── Dibujado del mapa: aeropuertos, vuelos y capa de selección ───────────────────

  const renderMap = useCallback(() => {
    const map = mapInst.current
    const L = window.L
    if (!map || !L) return

    // ── Aeropuertos ────────────────────────────────────────────────────────
    if (airportLayer.current) airportLayer.current.clearLayers()
    airportMarkers.current.clear()

    filteredAirports.forEach(a => {
      if (a.latitude == null || a.longitude == null) return
      const icon = airportIcon(a.occupancyPct)

      const incomingCount =
        filteredFlightsForMap.filter(fl => fl.destIata === a.iataCode).length

      const outgoingCount =
        filteredFlightsForMap.filter(fl => fl.originIata === a.iataCode).length

      const semaphore =
        getSemaphoreColor(a.occupancyPct)

      const popupAirport = {
        ...a,
        iata: a.iataCode,
        occupancy: a.occupancyPct,
        warehouseCapacity: a.capacity,
        currentOccupancy: a.assignedShipments,
      }

      const marker = L.marker(
        [a.latitude, a.longitude],
        { icon }
      )
        .addTo(airportLayer.current)
        .bindTooltip(airportTooltipHtml(a), { direction: 'top', offset: [0, -10] })
        .bindPopup(
          createReactPopup(
            AirportMapPopup,
            { airport: popupAirport, incomingCount, outgoingCount, semaphore }
          )
        )
        .on('click', () => handleAirportFocus(a.iataCode))
        .on('popupclose', () => {
          setSelectedAirportCode(prev => (prev === a.iataCode ? null : prev))
        })

      airportMarkers.current.set(a.iataCode, marker)
    })

    // ── Vuelos ─────────────────────────────────────────────────────────────
    if (flightLayer.current) flightLayer.current.clearLayers()
    flightMarkers.current.clear()

    filteredFlightsForMap.forEach(f => {
      if (!f.originLat || !f.originLng || !f.destLat || !f.destLng) return

      const isSelected = selectedFlightId != null && String(selectedFlightId) === String(f.flightId)
      const isDimmed = selectedFlightId != null && !isSelected
      const isInFlight = f.status === 'En vuelo' || f.status === 'IN_FLIGHT'

      // Posición interpolada usando la misma proyección que Leaflet
      const p1 = L.Projection.SphericalMercator.project({
        lat: f.originLat,
        lng: f.originLng,
      })

      const p2 = L.Projection.SphericalMercator.project({
        lat: f.destLat,
        lng: f.destLng,
      })

      const point = L.Projection.SphericalMercator.unproject({
        x: lerp(p1.x, p2.x, f.progress),
        y: lerp(p1.y, p2.y, f.progress),
      })

      const lat = point.lat
      const lng = point.lng

      if (isInFlight && isSelected) {
        // Vuelo seleccionado: línea sólida y resaltada (como antes), sin el fade discontinuo
        L.polyline(
          [[lat, lng], [f.destLat, f.destLng]],
          flightRouteStyle(f.status, { isSelected, isDimmed })
        ).addTo(flightLayer.current)
      } else if (isInFlight) {
        // Camino que falta por volar: posición actual → destino, azul discontinuo,
        // se va desvaneciendo hacia el destino a medida que el avión avanza.
        drawFlightPath(flightLayer.current, L, p1, p2, f.progress, 1, { isDimmed, isSelected })
      } else {
        // Vuelos programados: ruta completa origen → destino con el estilo habitual
        L.polyline(
          [[f.originLat, f.originLng], [f.destLat, f.destLng]],
          flightRouteStyle(f.status, { isSelected, isDimmed })
        ).addTo(flightLayer.current)
      }

      const isScheduled = f.status === 'Programado' || f.status === 'SCHEDULED'

      // El ícono se dibuja para vuelos "en vuelo" (posición interpolada, se
      // mueve) y para vuelos "programados" que YA tienen envíos asignados
      // (el backend solo manda SCHEDULED en el snapshot si tienen carga
      // comprometida — ver OpsFlightRepository.findFlightsWithPendingShipments).
      // Estos últimos se muestran fijos en el aeropuerto de origen, con menor
      // opacidad, para distinguirlos de un vuelo que ya está en el aire.
      // CANCELLED, LANDED y demás estados no muestran ícono, solo la línea.
      if (!isInFlight && !isScheduled) return

      const markerLat = isInFlight ? lat : f.originLat
      const markerLng = isInFlight ? lng : f.originLng

      const angle = getBearing(
        f.originLat,
        f.originLng,
        f.destLat,
        f.destLng
      )

      const loadPct =
        f.capacity > 0
          ? (f.assignedBags / f.capacity) * 100
          : 0

      // AGREGADO: vuelo "vacío" = sin envíos asignados (assignedBags 0).
      // planeIcon.js ya rasteriza un ícono gris ('#9E9E9E') dentro de
      // PLANE_IMAGES para el semáforo — lo reusamos en vez del color de carga.
      const isEmptyFlight = (f.assignedBags || 0) === 0

      const color = isEmptyFlight
        ? '#9E9E9E'
        : getSemaphoreColor(loadPct)

      const planeImage =
        PLANE_IMAGES[color]

      // Los programados aún no despegan: se pintan más tenues (y sin el fade
      // de "dimmed" por selección, que ya reduce aún más si aplica) para que
      // a simple vista se note la diferencia con los que sí están volando.
      const baseOpacity = isDimmed ? 0.15 : (isScheduled ? 0.55 : 1)

      const planeIcon = L.divIcon({

        className: '',

        html: `
    <div
      style="
        width:24px;
        height:24px;
        display:flex;
        align-items:center;
        justify-content:center;
        transform:rotate(${angle}deg);
        opacity:${baseOpacity};
      "
    >
      <img
        src="${planeImage?.src ?? ''}"
        width="24"
        height="24"
        draggable="false"
        style="
          display:block;
          pointer-events:none;
        "
      />
    </div>
  `,

        iconSize: [24, 24],

        iconAnchor: [12, 12]

      })

      const popupFlight = {
        ...f,
        origin: f.originIata,
        destination: f.destIata,
        bagsAboard: f.assignedBags,
      }

      const marker =
        L.marker([markerLat, markerLng], { icon: planeIcon })
          .addTo(flightLayer.current)

      flightMarkers.current.set(
        f.flightId,
        marker
      )

      marker
        .bindTooltip(
          isScheduled
            ? `${f.originIata} → ${f.destIata} (Programado)`
            : `${f.originIata} → ${f.destIata}`,
          { direction: 'top', offset: [0, -14] }
        )
        .bindPopup(
          createReactPopup(
            FlightMapPopup,
            { flight: popupFlight }
          )
        )
        .on('click', () => handleFlightFocus(f.flightId))
    })

    // ── Capa de selección: halo de almacén + ruta de envío ────────────────────
    if (selectionLayer.current) selectionLayer.current.clearLayers()

    if (selectedAirportCode) {
      const airport = airports.find(a => a.iataCode === selectedAirportCode)
      if (airport && airport.latitude != null && airport.longitude != null) {
        L.circleMarker(
          [airport.latitude, airport.longitude],
          {
            radius: 16,
            color: '#1F3864',
            weight: 2,
            opacity: 0.9,
            fillColor: '#2E75B6',
            fillOpacity: 0.18,
            interactive: false,
          }
        ).addTo(selectionLayer.current)
      }
    }

    if (selectedShipmentRoute) {
      const airportsByCode = new Map(airports.map(a => [a.iataCode, a]))
      selectedShipmentRoute.forEach(leg => {
        const orig = airportsByCode.get(leg.originIata)
        const dest = airportsByCode.get(leg.destIata)
        if (!orig || !dest) return
        L.polyline(
          [[orig.latitude, orig.longitude], [dest.latitude, dest.longitude]],
          { color: '#8E24AA', weight: 3, opacity: 0.9 }
        ).addTo(selectionLayer.current)
      })
    }

  }, [
    filteredAirports,
    filteredFlightsForMap,
    airports,
    selectedFlightId,
    selectedAirportCode,
    selectedShipmentRoute,
    handleAirportFocus,
    handleFlightFocus,
  ])

  // ── Inicializar mapa (una sola vez) ───────────────────────────────────────

  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [15, 0],

      zoom: 3.24,

      minZoom: 3,

      maxZoom: 4.5,

      zoomSnap: 0.1,

      zoomDelta: 0.5,

      zoomControl: true,

      maxBounds: [
        [-85.051129, -180],
        [85.051129, 180]
      ],

      maxBoundsViscosity: 1.0,

      worldCopyJump: false,

      preferCanvas: true
    })

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        noWrap: true,
        maxZoom: 19
      }
    ).addTo(map)

    airportLayer.current = L.layerGroup().addTo(map)
    flightLayer.current = L.layerGroup().addTo(map)
    selectionLayer.current = L.layerGroup().addTo(map)

    // Click en zona vacía del mapa limpia la selección activa
    map.on('click', () => {
      setSelectedAirportCode(null)
      setSelectedFlightId(null)
      setSelectedShipmentId(null)
    })

    mapInst.current = map
  }, [])

  // ── Redimensionar el mapa cuando cambia el ancho/colapso del panel ────────

  useEffect(() => {
    if (!mapInst.current) return
    const id = setTimeout(() => {
      mapInst.current.invalidateSize()
    }, 50)
    return () => clearTimeout(id)
  }, [collapsed, panelWidth])

  // ── Arrastre del panel (ajustable, no solo contraer/expandir) ─────────────

  const startDrag = useCallback((e) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const delta = dragStartX.current - e.clientX
      setPanelWidth(
        Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartWidth.current + delta))
      )
    }
    const onUp = () => { isDragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {

    if (!selectedFlightId)
      return

    const marker =
      flightMarkers.current.get(
        selectedFlightId
      )

    if (!marker || !mapInst.current)
      return

    mapInst.current.flyTo(
      marker.getLatLng(),
      4,
      {
        duration: 1.2
      }
    )

    setTimeout(() => {
      marker.openPopup()
    }, 400)

  }, [selectedFlightId])

  // ── Polling ────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Espera a tener la metadata de aeropuertos (continente) antes de empezar a pollear
    if (!airportMeta) return
    // Primer fetch inmediato tras montar el mapa
    const timeout = setTimeout(fetchSnapshot, 500)
    const interval = setInterval(fetchSnapshot, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchSnapshot, airportMeta])

  useEffect(() => {

    if (!selectedAirportCode)
      return

    const airport =
      airports.find(
        a =>
          a.iataCode ===
          selectedAirportCode
      )

    if (!airport)
      return

    mapInst.current.flyTo(
      [
        airport.latitude,
        airport.longitude
      ],
      6,
      {
        duration: 1.2
      }
    )

  }, [
    selectedAirportCode,
    airports
  ])


  useEffect(() => {
    Promise.all([
      initWarehouseIcons(),
      initPlaneIcons()
    ])
  }, [])

  // ── Redibujado: cada vez que cambian datos, filtros o selección ───────────
  useEffect(() => {
    renderMap()
  }, [renderMap])




  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >

      {/* MAPA */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
        }}
      >
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        <MapLegend />

        {/* Botón colapsar/expandir panel */}
        <Box
          onClick={() => setCollapsed(v => !v)}
          sx={{
            position: 'absolute',
            top: 16,
            right: 8,
            zIndex: 2000,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#1F3864',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {collapsed ? '←' : '→'}
        </Box>

        {lastUpdate && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 1000,
              backgroundColor: 'rgba(31,56,100,0.85)',
              color: '#90CAF9',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              pointerEvents: 'none',
            }}
          >
            Actualizado: {lastUpdate}
          </Box>
        )}
      </Box>

      {/* Divisor arrastrable — permite estirar/encoger el panel */}
      {!collapsed && (
        <Box
          onMouseDown={startDrag}
          sx={{
            width: 5,
            flexShrink: 0,
            cursor: 'col-resize',
            backgroundColor: '#BFBFBF',
            transition: 'background-color 0.15s',
            '&:hover': { backgroundColor: '#2E75B6' },
          }}
        />
      )}

      {/* PANEL */}
      <Box
        sx={{
          width: collapsed ? 0 : panelWidth,
          flexShrink: 0,
          overflow: 'hidden',
          transition: collapsed ? 'width 0.25s ease' : 'none',
          borderLeft: collapsed
            ? 'none'
            : '1px solid rgba(0,0,0,0.12)',
          backgroundColor: '#fff',
        }}
      >
        <OpsPanel
          airports={airports}
          flights={flights}
          shipments={shipments}
          selectedFlightId={selectedFlightId}
          selectedAirportCode={selectedAirportCode}
          selectedShipmentId={selectedShipmentId}
          onFlightSelected={handleFlightFocus}
          onAirportSelected={handleAirportFocus}
          onShipmentFocus={handleShipmentFocus}
          warehouseFilters={warehouseFilters}
          onWarehouseFiltersChange={setWarehouseFilters}
          onlyWithShipments={onlyWithShipments}
          onOnlyWithShipmentsChange={setOnlyWithShipments}
          onFlightCancelled={fetchSnapshot}
        />
      </Box>

    </Box>
  )
}