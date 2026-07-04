import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { PLANE_IMAGES } from './planeIcon'
import { getSemaphoreColor } from '../../utils/semaphoreUtils'
import { useSimulationContext } from '../../context/SimulationContext'

const DRAW_SIZE = 24   // CSS pixels the plane bitmap is drawn at
const CLICK_HIT_PX = 14  // click detection radius in CSS pixels

function lerp(a, b, t) { return a + (b - a) * t }

// Computes {latlng, angleRad, flight} for each visible in-flight plane.
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

    const pct = f.capacity > 0 ? (f.bagsAboard || 0) / f.capacity * 100 : 0
    const color = getSemaphoreColor(pct)
    out.push({ latlng: L.latLng(ll.lat, ll.lng), angleRad, flight: f, color })
  }
  return out
}

/**
 * PlaneCanvasLayer — renders all in-flight planes onto a single <canvas> element
 * positioned over the Leaflet map container.
 *
 * A requestAnimationFrame loop redraws at ~60fps, interpolating plane positions
 * from animClockRef so movement is smooth between WebSocket ticks.
 */
export default function PlaneCanvasLayer({ flights, airportsByCode, onPlaneClick, planePopupRef, activePlaneFlightId, animClockRefOverride = null }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const positionsRef = useRef([])
  const drawRef = useRef(null)
  const activePlaneFlightIdRef = useRef(activePlaneFlightId)

  let context = null
  try { context = useSimulationContext() } catch (_) {}
  const setSelectedFlightId = context?.setSelectedFlightId
  const setActivePanelTab = context?.setActivePanelTab
  const animClockRef = animClockRefOverride ?? context?.animClockRef

  // Keep stable refs to latest props so the rAF callback never closes over stale values
  const flightsRef = useRef(flights)
  const airportsByCodeRef = useRef(airportsByCode)
  const onPlaneClickRef = useRef(onPlaneClick)
  const planePopupRefRef = useRef(planePopupRef)
  useEffect(() => { flightsRef.current = flights }, [flights])
  useEffect(() => { airportsByCodeRef.current = airportsByCode }, [airportsByCode])
  useEffect(() => { onPlaneClickRef.current = onPlaneClick }, [onPlaneClick])
  useEffect(() => { planePopupRefRef.current = planePopupRef }, [planePopupRef])
  useEffect(() => { activePlaneFlightIdRef.current = activePlaneFlightId }, [activePlaneFlightId])

  // drawRef always holds the latest draw function without needing effect re-runs.
  // We use a ref instead of useCallback so map event listeners never go stale.
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const half = DRAW_SIZE / 2
      ctx.save()
      ctx.scale(dpr, dpr)  // one scale call for HiDPI; all coords below are CSS pixels
      for (const { latlng, angleRad, color } of positionsRef.current) {
        const img = PLANE_IMAGES[color]
        if (!img?.complete || !img.naturalWidth) continue
        const pt = map.latLngToContainerPoint(latlng)
        ctx.save()
        ctx.translate(pt.x, pt.y)
        ctx.rotate(angleRad)
        ctx.drawImage(img, -half, -half, DRAW_SIZE, DRAW_SIZE)
        ctx.restore()
      }
      ctx.restore()

      // Track the React popup overlay to the plane's current position
      const popupDom = planePopupRefRef.current?.current
      if (popupDom && activePlaneFlightIdRef.current != null) {
        const pos = positionsRef.current.find(p => String(p.flight.id) === String(activePlaneFlightIdRef.current))
        if (pos) {
          const pt = map.latLngToContainerPoint(pos.latlng)
          popupDom.style.left = pt.x + 'px'
          popupDom.style.top = pt.y + 'px'
        }
      }
    }
  })

  // rAF loop: recomputes plane positions at ~60fps using interpolated sim time.
  // Reads flights/airports via refs to avoid stale closures without restarting the loop.
  useEffect(() => {
    let rafId
    function tick() {
      const clock = animClockRef?.current
      let simTime = null
      if (clock?.lastTickSimTime && clock?.lastTickRealTime && clock?.simMsPerRealMs) {
        simTime = new Date(
          clock.lastTickSimTime.getTime() +
          (Date.now() - clock.lastTickRealTime) * clock.simMsPerRealMs
        )
      }
      positionsRef.current = computePlanePositions(flightsRef.current, airportsByCodeRef.current, simTime)
      drawRef.current?.()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [animClockRef])

  // Mount the canvas and wire up Leaflet events. Runs once per map instance.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    const canvas = document.createElement('canvas')
    // z-index 405: above overlay pane (400 — polylines) but below marker/tooltip/popup panes.
    // Canvas must live on map.getContainer() (not inside a translated Leaflet pane) so its
    // coordinate space stays fixed to the viewport. If placed inside leaflet-map-pane the
    // CSS transform that Leaflet applies when panning shifts the canvas off-screen, creating
    // an invisible clipping box equal to the initial viewport size.
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:405;'
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
          onPlaneClickRef.current?.({ flight, x: pt.x, y: pt.y })
          return
        }
      }
      // Clicked away from any plane — close the popup
      onPlaneClickRef.current?.(null)
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
