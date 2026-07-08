import { useEffect, useRef, useState, useCallback } from 'react'
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

function flightRouteStyle(status) {

  const isInFlight =
    status === 'En vuelo' ||
    status === 'IN_FLIGHT'

  const isCancelled =
    status === 'Cancelado' ||
    status === 'CANCELLED'

  if (isCancelled) {
    return { color: '#C62828', weight: 0.6, opacity: 0.5, dashArray: '3 5' }
  }

  return {

    color: isInFlight
      ? '#FB8C00'
      : '#2E75B6',

    weight: isInFlight
      ? 0.5
      : 0.4,

    opacity: isInFlight
      ? 0.45
      : 0.20,

    dashArray: isInFlight
      ? '8 6'
      : '4 6'

  }

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

      setAirports(data.airports || [])
      setFlights(normalizedFlights)
      setShipments(data.shipments || [])

      // ── Aeropuertos ────────────────────────────────────────────────────────
      if (airportLayer.current) airportLayer.current.clearLayers()
      airportMarkers.current.clear()
        ; (data.airports || []).forEach(a => {
          if (a.latitude == null || a.longitude == null) return
          const icon = airportIcon(a.occupancyPct)

          const incomingCount =
            normalizedFlights.filter(
              fl => fl.destination === a.iataCode
            ).length

          const outgoingCount =
            normalizedFlights.filter(
              fl => fl.origin === a.iataCode
            ).length

          const semaphore =
            getSemaphoreColor(a.occupancyPct)


          const popupAirport = {

            ...a,

            // nombres que espera AirportMapPopup
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
                {
                  airport: popupAirport,
                  incomingCount,
                  outgoingCount,
                  semaphore,
                }
              )
            )
            .on('click', () => {
              setSelectedAirportCode(a.iataCode)
            })
            .on('popupclose', () => {
              setSelectedAirportCode(null)
            })

        })

      // ── Vuelos activos con maletas ──────────────────────────────────────────
      if (flightLayer.current) flightLayer.current.clearLayers()
      flightMarkers.current.clear()

        ; normalizedFlights.forEach(f => {
          if (!f.originLat || !f.originLng || !f.destLat || !f.destLng) return

          // Línea de ruta tenue
          L.polyline(
            [
              [f.originLat, f.originLng],
              [f.destLat, f.destLng]
            ],
            flightRouteStyle(f.status)
          ).addTo(flightLayer.current)

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


          const angle = getBearing(
            f.originLat,
            f.originLng,
            f.destLat,
            f.destLng
          )
          // Ícono de avión (emoji SVG embebido para no depender de imágenes externas)
          const loadPct =
            f.capacity > 0
              ? (f.assignedBags / f.capacity) * 100
              : 0

          const color =
            getSemaphoreColor(loadPct)

          const planeImage =
            PLANE_IMAGES[color]

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
            L.marker([lat, lng], { icon: planeIcon })
              .addTo(flightLayer.current)

          flightMarkers.current.set(
            f.flightId,
            marker
          )

          marker
            .bindTooltip(
              `${f.originIata} → ${f.destIata}`,
              {
                direction: 'top',
                offset: [0, -14]
              }
            )
            .bindPopup(
              createReactPopup(
                FlightMapPopup,
                {
                  flight: popupFlight
                }
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
    Promise.all([
      initWarehouseIcons(),
      initPlaneIcons()
    ])
  }, [])




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