import React, { useMemo, useRef, useEffect } from 'react'
import { Polyline, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import LuggageIcon from '@mui/icons-material/Luggage'
import { useSimulationContext } from '../../context/SimulationContext'

function lerp(a, b, t) {
  return a + (b - a) * t
}

// A single shared, unrotated icon. The heading is applied per-marker by
// rotating its DOM element directly (see rotatePlaneMarker), so every flight
// gets its exact bearing instead of being snapped to a fixed set of angles,
// and no new divIcon/SVG string needs to be built per flight or per render.
const PLANE_ICON = L.divIcon({
  className: '',
  html: `<div class="plane-rotor" style="line-height:0;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.5));"><svg xmlns='http://www.w3.org/2000/svg' viewBox='-10 -10 20 20' width='15' height='15'><path d='M0,-9 L1.5,-6 L1.5,-2 L8,2 L8,4 L1.5,2 L1.5,6 L3,8.5 L0,7.5 L-3,8.5 L-1.5,6 L-1.5,2 L-8,4 L-8,2 L-1.5,-2 L-1.5,-6 Z' fill='#1F3864' stroke='white' stroke-width='0.6'/></svg></div>`,
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
})

// Rotates a mounted marker's icon element in place, in CSS pixel/transform
// space — avoids recreating the icon (and its DOM) for every heading.
function rotatePlaneMarker(marker, angle) {
  const el = marker?.getElement?.()
  const rotor = el?.firstChild
  if (rotor) rotor.style.transform = `rotate(${angle}deg)`
}

/**
 * FlightRoute — renders a Polyline for a flight route.
 * If the flight is IN_FLIGHT, renders an animated plane icon at the progress point.
 */
function FlightRoute({ flight, airportsByCode, simulatedTime }) {
  const originAirport = airportsByCode?.get(flight.origin)
  const destAirport = airportsByCode?.get(flight.destination)

  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  const setSelectedFlightId = context ? context.setSelectedFlightId : null
  const setActivePanelTab = context ? context.setActivePanelTab : null

  const isInFlight = flight.status === 'IN_FLIGHT'

  const progress = useMemo(() => {
    if (!isInFlight) return 0
    if (simulatedTime && flight.departureUTC && flight.arrivalUTC) {
      const dep = new Date(flight.departureUTC).getTime()
      const arr = new Date(flight.arrivalUTC).getTime()
      const now = simulatedTime instanceof Date ? simulatedTime.getTime() : new Date(simulatedTime).getTime()
      if (arr > dep) return Math.max(0, Math.min(1, (now - dep) / (arr - dep)))
    }
    return flight.progress || 0
  }, [isInFlight, flight.progress, flight.departureUTC, flight.arrivalUTC, simulatedTime])

  const { progressPosition, angle } = useMemo(() => {
    if (!originAirport || !destAirport) return { progressPosition: null, angle: 0 }

    const lat1 = originAirport.lat
    const lon1 = originAirport.lon
    const lat2 = destAirport.lat
    const lon2 = destAirport.lon

    // Leaflet draws the Polyline in projected (Mercator) space, where latitude
    // is non-linear. Interpolating raw lat/lon puts the plane off the rendered
    // line, so interpolate in the same projected space the line uses instead.
    const p1 = L.Projection.SphericalMercator.project({ lat: lat1, lng: lon1 })
    const p2 = L.Projection.SphericalMercator.project({ lat: lat2, lng: lon2 })

    // Compass bearing: 0° = north, 90° = east (clockwise). SVG plane points
    // north at 0°. Note: raw SphericalMercator.project() y increases
    // NORTHWARD (standard projected meters), unlike on-screen pixels where y
    // increases downward — so the northward delta is (p2.y - p1.y) directly,
    // with no sign flip.
    const rot = Math.atan2(p2.x - p1.x, p2.y - p1.y) * (180 / Math.PI)

    // Only show plane when it's clearly between airports (not sitting on origin/destination dot)
    if (!isInFlight || progress < 0.02 || progress > 0.98) return { progressPosition: null, angle: rot }

    const px = lerp(p1.x, p2.x, progress)
    const py = lerp(p1.y, p2.y, progress)
    const latlng = L.Projection.SphericalMercator.unproject({ x: px, y: py })

    return {
      progressPosition: [latlng.lat, latlng.lng],
      angle: rot
    }
  }, [isInFlight, progress, originAirport, destAirport])

  if (!originAirport || !destAirport) return null

  const positions = [
    [originAirport.lat, originAirport.lon],
    [destAirport.lat, destAirport.lon],
  ]

  const lineColor = isInFlight ? '#FB8C00' : '#2E75B6'
  const lineWeight = isInFlight ? 0.75 : 0.6
  const lineOpacity = isInFlight ? 0.85 : 0.4
  const dashArray = isInFlight ? '8 6' : '4 6'

  const markerRef = useRef(null)

  useEffect(() => {
    rotatePlaneMarker(markerRef.current, angle)
  }, [angle, progressPosition])

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: lineColor,
          weight: lineWeight,
          opacity: lineOpacity,
          dashArray,
        }}
      />
      {isInFlight && progressPosition && (
        <Marker
          ref={markerRef}
          position={progressPosition}
          icon={PLANE_ICON}
          zIndexOffset={1000}
          eventHandlers={{
            add: (e) => rotatePlaneMarker(e.target, angle),
            click: () => {
              if (setSelectedFlightId && setActivePanelTab) {
                setSelectedFlightId(flight.id)
                setActivePanelTab(1) // 1 corresponds to Flights Tab
              }
            }
          }}
        >
          <Popup minWidth={200}>
            <Box sx={{ p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: '#1F3864' }}>
                <FlightTakeoffIcon sx={{ mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Vuelo {flight.id || 'N/A'}
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Origen:</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{flight.origin}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Destino:</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{flight.destination}</Typography>
              </Box>
              
              <Box sx={{ mt: 1.5, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <LuggageIcon sx={{ fontSize: 16, mr: 0.5, color: '#2E75B6' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Capacidad de Carga</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1F3864' }}>
                    {flight.bagsAboard || 0} / {flight.capacity || 0}
                  </Typography>
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                    {Math.round(((flight.bagsAboard || 0) / (flight.capacity || 1)) * 100)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Popup>
        </Marker>
      )}
    </>
  )
}

export default React.memo(FlightRoute)
