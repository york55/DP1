import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import client from '../../api/client'

// Tooltip rápido (hover): vista compacta para identificar el aeropuerto al pasar el mouse
const airportTooltipHtml = (a) => `
  <div style="font-size:12.5px; line-height:1.4;">
    <div style="font-weight:600; color:#1F3864;">${a.iataCode} · ${a.name}</div>
    <div style="color:#555;">${a.country}</div>
  </div>
`

// Popup persistente (click): detalle con ocupación 0/capacidad
const airportPopupHtml = (a) => `
  <div style="font-size:13px; line-height:1.6; min-width:160px;">
    <div style="font-weight:700; font-size:14px; color:#1F3864; margin-bottom:2px;">
      ${a.name}
    </div>
    <div style="color:#777; margin-bottom:8px;">${a.iataCode} · ${a.country}</div>
    <div style="display:flex; justify-content:space-between; border-top:1px solid #eee; padding-top:6px;">
      <span style="color:#555;">Ocupación</span>
      <span style="font-weight:600;">0 / ${a.capacity}</span>
    </div>
  </div>
`

export default function RealtimeMapPage() {
  const mapRef  = useRef(null)
  const mapInst = useRef(null)
  const [airports, setAirports] = useState([])

  // Fetch de aeropuertos desde OPS_AIRPORT
  useEffect(() => {
    client.get('/ops/airports')
      .then(res => setAirports(res.data))
      .catch(e => console.error('Error fetching ops/airports:', e))
  }, [])

  // Inicializar mapa
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 2,
      zoomControl: true,
      minZoom: 2,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    })

    // noWrap evita que el mapa se repita infinitamente al desplazarse a los extremos
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      noWrap: true,
    }).addTo(map)

    mapInst.current = map
  }, [])

  // Pintar marcadores de aeropuertos en cuanto llegan del API
  useEffect(() => {
    const map = mapInst.current
    const L = window.L
    if (!map || !L || airports.length === 0) return

    airports.forEach(a => {
      if (a.latitude == null || a.longitude == null) return
      const icon = L.divIcon({
        html: `<div style="
          background:#2E75B6;width:14px;height:14px;
          border-radius:50%;border:2.5px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.45);
        "></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: '',
      })
      L.marker([a.latitude, a.longitude], { icon })
        .addTo(map)
        .bindTooltip(airportTooltipHtml(a), { direction: 'top', offset: [0, -10] })
        .bindPopup(airportPopupHtml(a))
    })
  }, [airports])

  return (
    <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  )
}