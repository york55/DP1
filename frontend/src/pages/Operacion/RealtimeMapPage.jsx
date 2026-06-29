import { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import client from '../../api/client'
import OpsPanel from '../../components/ops/OpsPanel'
import MapLegend from '../../components/ops/MapLegend'
import { createRoot } from 'react-dom/client'
import { createReactPopup }
  from '../../utils/leafletPopup'

import OpsAirportPopup
  from '../../components/ops/OpsAirportPopup'

import OpsFlightPopup
  from '../../components/ops/OpsFlightPopup'

const POLL_INTERVAL_MS = 30_000 // refresca cada 30 s

// Color del semáforo de aeropuerto según ocupación
function airportColor(pct) {
  if (pct >= 80) return '#C62828'  // rojo
  if (pct >= 50) return '#F57C00'  // naranja
  return '#2E75B6'                  // azul normal
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

// Tooltip compacto al hacer hover sobre un aeropuerto
const airportTooltipHtml = (a) => `
  <div style="font-size:12.5px;line-height:1.4;">
    <div style="font-weight:600;color:#1F3864;">${a.iataCode} · ${a.name}</div>
    <div style="color:#555;">${a.country}</div>
    <div style="color:#777;margin-top:2px;">Ocupación: ${a.assignedShipments} / ${a.capacity}</div>
  </div>
`

// Popup al hacer click sobre un aeropuerto
const airportPopupHtml = (a) => `
  <div style="font-size:13px;line-height:1.6;min-width:170px;">
    <div style="font-weight:700;font-size:14px;color:#1F3864;margin-bottom:2px;">${a.name}</div>
    <div style="color:#777;margin-bottom:8px;">${a.iataCode} · ${a.country}</div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:6px;">
      <span style="color:#555;">Ocupación</span>
      <span style="font-weight:600;">${a.assignedShipments} / ${a.capacity}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="color:#555;">% ocupado</span>
      <span style="font-weight:600;color:${airportColor(a.occupancyPct)};">
        ${a.occupancyPct.toFixed(1)}%
      </span>
    </div>
  </div>
`

// Popup al hacer click sobre un avión en vuelo
const flightPopupHtml = (f) => {
  const dep = new Date(f.depTimeUtc).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const arr = new Date(f.arrTimeUtc).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const pctLoad = f.capacity > 0 ? ((f.assignedBags / f.capacity) * 100).toFixed(1) : '0.0'
  return `
    <div style="font-size:13px;line-height:1.7;min-width:190px;">
      <div style="font-weight:700;font-size:14px;color:#1F3864;margin-bottom:4px;">
        ${f.originIata} → ${f.destIata}
      </div>
      <div style="color:#777;margin-bottom:6px;">${f.originName} → ${f.destName}</div>
      <div style="border-top:1px solid #eee;padding-top:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#555;">Salida (UTC)</span>
          <span style="font-weight:600;">${dep}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#555;">Llegada (UTC)</span>
          <span style="font-weight:600;">${arr}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#555;">Maletas</span>
          <span style="font-weight:600;">${f.assignedBags} / ${f.capacity} (${pctLoad}%)</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#555;">Estado</span>
          <span style="font-weight:600;">${f.status}</span>
        </div>
      </div>
    </div>
  `
}

export default function RealtimeMapPage() {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const airportLayer = useRef(null)  // LayerGroup para aeropuertos
  const flightMarkers = useRef(new Map()) // LayerGroup para aviones
  const airportMarkers =
    useRef(new Map())
  const flightLayer = useRef(null)

  const [lastUpdate, setLastUpdate] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [shipments, setShipments] = useState([])
  const [selectedFlightId, setSelectedFlightId] =
    useState(null)

  const [selectedAirportCode, setSelectedAirportCode] =
    useState(null)


  // ── Fetch del snapshot y pintado ──────────────────────────────────────────

  const fetchAndRender = useCallback(async () => {
    const map = mapInst.current
    const L = window.L
    if (!map || !L) return

    try {
      const res = await client.get('/ops/map/snapshot')
      const data = res.data

      const STATUS_LABEL = {
        IN_FLIGHT:  'En vuelo',
        SCHEDULED:  'Programado',
        LANDED:     'Aterrizado',
        CANCELLED:  'Cancelado',
        DELAYED:    'Demorado',
      }

      const normalizedFlights = (data.flights || []).map(f => ({
        ...f,
        status: STATUS_LABEL[f.status] ?? f.status,
      }))

      setAirports(data.airports || [])
      setFlights(normalizedFlights)
      setShipments(data.shipments || [])

      // ── Aeropuertos ────────────────────────────────────────────────────────
      if (airportLayer.current) airportLayer.current.clearLayers()
      airportMarkers.current.clear()
        ; (data.airports || []).forEach(a => {
          if (a.latitude == null || a.longitude == null) return
          const color = airportColor(a.occupancyPct)

          const size =
            25 + (a.occupancyPct / 100) * 10

          const icon = L.divIcon({
            html: `
    <div style="
      width:${size + 10}px;
      height:${size + 10}px;
      border-radius:50%;
      background:${color}33;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        background:${color};
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
      "></div>
    </div>
  `,
            iconSize: [size + 10, size + 10],
            iconAnchor: [(size + 10) / 2, (size + 10) / 2],
            className: '',
          })
          const marker = L.marker(
            [a.latitude, a.longitude],
            { icon }
          )
            .addTo(airportLayer.current)
            .bindTooltip(airportTooltipHtml(a), { direction: 'top', offset: [0, -10] })
            .bindPopup(
              createReactPopup(
                OpsAirportPopup,
                { airport: a }
              )
            )
            .on('click', () => {
              setSelectedAirportCode(a.iataCode)
            })

        })

      // ── Vuelos activos con maletas ──────────────────────────────────────────
      if (flightLayer.current) flightLayer.current.clearLayers()
      flightMarkers.current.clear()

        ; normalizedFlights.forEach(f => {
          if (!f.originLat || !f.originLng || !f.destLat || !f.destLng) return

          // Línea de ruta tenue
          L.polyline(
            [[f.originLat, f.originLng], [f.destLat, f.destLng]],
            { color: '#2E75B6', weight: 1.5, opacity: 0.35, dashArray: '6 4' }
          ).addTo(flightLayer.current)

          // Posición interpolada del avión
          const lat = f.originLat + (f.destLat - f.originLat) * f.progress
          const lng = f.originLng + (f.destLng - f.originLng) * f.progress

          const angle = getBearing(
            f.originLat,
            f.originLng,
            f.destLat,
            f.destLng
          )
          // Ícono de avión (emoji SVG embebido para no depender de imágenes externas)
          const planeIcon = L.divIcon({

            html: `
    <div style="
      width:34px;
      height:34px;
      display:flex;
      align-items:center;
      justify-content:center;
      transform:rotate(${angle}deg);
    ">

      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="#092c54"
        xmlns="http://www.w3.org/2000/svg"
        style="
          filter:
            drop-shadow(0 2px 4px rgba(0,0,0,.35));
        "
      >
        <path d="
          M21 16V14L13 9V3.5
          A1.5 1.5 0 0 0 10 3.5V9
          L2 14V16L10 13.5V19
          L7.5 20.5V22L11.5 21
          L15.5 22V20.5L13 19
          V13.5L21 16Z
        "/>
      </svg>

    </div>
  `,

            iconSize: [34, 34],
            iconAnchor: [17, 17],
            className: '',
          })

          const marker =
            L.marker([lat, lng], { icon: planeIcon })
              .addTo(flightLayer.current)

          flightMarkers.current.set(
            f.flightId,
            marker
          )

          marker
            .bindTooltip(`${f.originIata} → ${f.destIata}`, { direction: 'top', offset: [0, -14] })
            .bindPopup(
              createReactPopup(
                OpsFlightPopup,
                { flight: f }
              )
            )
        })

      setLastUpdate(new Date().toLocaleTimeString('es-PE'))
    } catch (e) {
      console.error('Error fetching ops/map/snapshot:', e)
    }
  }, [])

  // ── Inicializar mapa ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapInst.current) return

    setTimeout(() => {
      mapInst.current.invalidateSize()
    }, 300)

  }, [panelOpen])

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

  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [20, 10], zoom: 2, zoomControl: true,
      minZoom: 2,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    })



    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      noWrap: true,
    }).addTo(map)

    airportLayer.current = L.layerGroup().addTo(map)
    flightLayer.current = L.layerGroup().addTo(map)

    mapInst.current = map
  }, [])

  // ── Polling ────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Primer fetch inmediato tras montar el mapa
    const timeout = setTimeout(fetchAndRender, 500)
    const interval = setInterval(fetchAndRender, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchAndRender])

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

        {/* Botón panel */}
        <Box
          onClick={() => setPanelOpen(!panelOpen)}
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
          {panelOpen ? '→' : '←'}
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

      {/* PANEL */}
      <Box
        sx={{
          width: panelOpen ? 500 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          borderLeft: panelOpen
            ? '1px solid rgba(0,0,0,0.12)'
            : 'none',
          backgroundColor: '#fff',
        }}
      >
        <OpsPanel
          airports={airports}
          flights={flights}
          shipments={shipments}
          onFlightSelected={setSelectedFlightId}
          onAirportSelected={setSelectedAirportCode}
          selectedAirportCode={selectedAirportCode}
        />
      </Box>

    </Box>
  )
}