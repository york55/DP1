import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { PLANE_IMAGE } from './planeIcon'
import { useSimulationContext } from '../../context/SimulationContext'

const DRAW_SIZE = 24   // CSS pixels the plane bitmap is drawn at
const CLICK_HIT_PX = 14  // click detection radius in CSS pixels

function lerp(a, b, t) { return a + (b - a) * t }

// Computes {latlng, angleRad, flight} for each visible in-flight plane.
// Called at most 1Hz (when simulatedTime or flight data changes).
function computePlanePositions(flights, airportsByCode, simulatedTime) {
  const out = []
  for (const f of flights) {
    if (f.status !== 'IN_FLIGHT') continue
    const orig = airportsByCode.get(f.origin)
    const dest = airportsByCode.get(f.destination)
    if (!orig || !dest) continue

    let progress = f.progress || 0
    if (simulatedTime && f.departureUTC && f.arrivalUTC) {
      const dep = new Date(f.departureUTC).getTime()
      const arr = new Date(f.arrivalUTC).getTime()
      const now = simulatedTime instanceof Date ? simulatedTime.getTime() : new Date(simulatedTime).getTime()
      if (arr > dep) progress = Math.max(0, Math.min(1, (now - dep) / (arr - dep)))
    }
    if (progress < 0.02 || progress > 0.98) continue

    // Interpolate in Mercator space (same projection the Polyline uses)
    const p1 = L.Projection.SphericalMercator.project({ lat: orig.lat, lng: orig.lon })
    const p2 = L.Projection.SphericalMercator.project({ lat: dest.lat, lng: dest.lon })

    // atan2(dx, dy) with northward y gives correct compass bearing (0=north, clockwise)
    const angleRad = Math.atan2(p2.x - p1.x, p2.y - p1.y)

    const ll = L.Projection.SphericalMercator.unproject({
      x: lerp(p1.x, p2.x, progress),
      y: lerp(p1.y, p2.y, progress),
    })

    out.push({ latlng: L.latLng(ll.lat, ll.lng), angleRad, flight: f })
  }
  return out
}

/**
 * PlaneCanvasLayer — renders all in-flight planes onto a single <canvas> element
 * positioned over the Leaflet map container.
 *
 * Replacing N individual Leaflet Marker DOM elements with a single canvas eliminates
 * per-plane DOM node creation, style mutations, and React reconciliation on every tick.
 * Redraws happen only when flight data changes (≤1Hz) or the map pans/zooms.
 */
export default function PlaneCanvasLayer({ flights, airportsByCode, simulatedTime }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const positionsRef = useRef([])
  const drawRef = useRef(null)

  let context = null
  try { context = useSimulationContext() } catch (_) {}
  const setSelectedFlightId = context?.setSelectedFlightId
  const setActivePanelTab = context?.setActivePanelTab

  // drawRef always holds the latest draw function without needing effect re-runs.
  // We use a ref instead of useCallback so map event listeners never go stale.
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!PLANE_IMAGE?.complete || !PLANE_IMAGE.naturalWidth) return

      const half = DRAW_SIZE / 2
      ctx.save()
      ctx.scale(dpr, dpr)  // one scale call for HiDPI; all coords below are CSS pixels
      for (const { latlng, angleRad } of positionsRef.current) {
        const pt = map.latLngToContainerPoint(latlng)
        ctx.save()
        ctx.translate(pt.x, pt.y)
        ctx.rotate(angleRad)
        ctx.drawImage(PLANE_IMAGE, -half, -half, DRAW_SIZE, DRAW_SIZE)
        ctx.restore()
      }
      ctx.restore()
    }
  })

  // Recompute positions when flight data or time changes, then redraw.
  // This is the only path that runs React's reconciler — max 1Hz from simulatedTime.
  useEffect(() => {
    positionsRef.current = computePlanePositions(flights, airportsByCode, simulatedTime)
    drawRef.current?.()
  }, [flights, airportsByCode, simulatedTime])

  // Mount the canvas and wire up Leaflet events. Runs once per map instance.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    const canvas = document.createElement('canvas')
    // pointer-events:none lets map pan/click pass through; we intercept via map.on('click')
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:410;'
    canvasRef.current = canvas
    map.getContainer().appendChild(canvas)

    function resize() {
      const { x, y } = map.getSize()
      canvas.width = x * dpr
      canvas.height = y * dpr
      canvas.style.width = x + 'px'
      canvas.style.height = y + 'px'
      drawRef.current?.()
    }

    function onMove() { drawRef.current?.() }

    function onMapClick(e) {
      const { x: cx, y: cy } = e.containerPoint
      for (const { latlng, flight } of positionsRef.current) {
        const pt = map.latLngToContainerPoint(latlng)
        if (Math.hypot(pt.x - cx, pt.y - cy) < CLICK_HIT_PX) {
          setSelectedFlightId?.(flight.id)
          setActivePanelTab?.(1)
          return
        }
      }
    }

    resize()
    map.on('resize', resize)
    map.on('move zoom moveend zoomend viewreset', onMove)
    map.on('click', onMapClick)

    return () => {
      map.off('resize', resize)
      map.off('move zoom moveend zoomend viewreset', onMove)
      map.off('click', onMapClick)
      canvas.remove()
      canvasRef.current = null
    }
  }, [map, setSelectedFlightId, setActivePanelTab])

  return null
}
