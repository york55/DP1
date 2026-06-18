import { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import client from '../../api/client'

const POLL_INTERVAL_MS = 30_000 // refresca cada 30 s

// Color del semáforo de aeropuerto según ocupación
function airportColor(pct) {
  if (pct >= 80) return '#C62828'  // rojo
  if (pct >= 50) return '#F57C00'  // naranja
  return '#2E75B6'                  // azul normal
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
  const dep = new Date(f.depTimeUtc).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  const arr = new Date(f.arrTimeUtc).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
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
  const mapRef       = useRef(null)
  const mapInst      = useRef(null)
  const airportLayer = useRef(null)  // LayerGroup para aeropuertos
  const flightLayer  = useRef(null)  // LayerGroup para aviones

  const [lastUpdate, setLastUpdate] = useState(null)

  // ── Fetch del snapshot y pintado ──────────────────────────────────────────

  const fetchAndRender = useCallback(async () => {
    const map = mapInst.current
    const L   = window.L
    if (!map || !L) return

    try {
      const res  = await client.get('/ops/map/snapshot')
      const data = res.data

      // ── Aeropuertos ────────────────────────────────────────────────────────
      if (airportLayer.current) airportLayer.current.clearLayers()

      ;(data.airports || []).forEach(a => {
        if (a.latitude == null || a.longitude == null) return
        const color = airportColor(a.occupancyPct)
        const icon  = L.divIcon({
          html: `<div style="
            background:${color};width:14px;height:14px;
            border-radius:50%;border:2.5px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.45);
          "></div>`,
          iconSize: [28, 28], iconAnchor: [14, 14], className: '',
        })
        L.marker([a.latitude, a.longitude], { icon })
          .addTo(airportLayer.current)
          .bindTooltip(airportTooltipHtml(a), { direction: 'top', offset: [0, -10] })
          .bindPopup(airportPopupHtml(a))
      })

      // ── Vuelos activos con maletas ──────────────────────────────────────────
      if (flightLayer.current) flightLayer.current.clearLayers()

      ;(data.flights || []).forEach(f => {
        if (!f.originLat || !f.originLng || !f.destLat || !f.destLng) return

        // Línea de ruta tenue
        L.polyline(
          [[f.originLat, f.originLng], [f.destLat, f.destLng]],
          { color: '#2E75B6', weight: 1.5, opacity: 0.35, dashArray: '6 4' }
        ).addTo(flightLayer.current)

        // Posición interpolada del avión
        const lat = f.originLat + (f.destLat - f.originLat) * f.progress
        const lng = f.originLng + (f.destLng - f.originLng) * f.progress

        // Ícono de avión (emoji SVG embebido para no depender de imágenes externas)
        const planeIcon = L.divIcon({
          html: `<div style="
            background:#1F3864;
            color:white;
            font-size:15px;
            width:24px;height:24px;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.4);
            cursor:pointer;
          ">✈</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12], className: '',
        })

        L.marker([lat, lng], { icon: planeIcon })
          .addTo(flightLayer.current)
          .bindTooltip(`${f.originIata} → ${f.destIata}`, { direction: 'top', offset: [0, -14] })
          .bindPopup(flightPopupHtml(f))
      })

      setLastUpdate(new Date().toLocaleTimeString('es-PE'))
    } catch (e) {
      console.error('Error fetching ops/map/snapshot:', e)
    }
  }, [])

  // ── Inicializar mapa ───────────────────────────────────────────────────────

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
    flightLayer.current  = L.layerGroup().addTo(map)

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

  return (
    <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {lastUpdate && (
        <Box sx={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          backgroundColor: 'rgba(31,56,100,0.85)',
          color: '#90CAF9', fontSize: '0.72rem', fontFamily: 'monospace',
          px: 1.5, py: 0.5, borderRadius: '6px',
          pointerEvents: 'none',
        }}>
          Actualizado: {lastUpdate}
        </Box>
      )}
    </Box>
  )
}