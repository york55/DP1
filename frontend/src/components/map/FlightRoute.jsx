import React, { useMemo } from 'react'
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

const createPlaneIcon = (angle) => L.divIcon({
  className: '',
  html: `<div style="transform:rotate(${angle}deg);line-height:0;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.5));"><svg xmlns='http://www.w3.org/2000/svg' viewBox='-10 -10 20 20' width='22' height='22'><path d='M0,-9 L1.5,-6 L1.5,-2 L8,2 L8,4 L1.5,2 L1.5,6 L3,8 L3,9 L0,7.5 L-3,9 L-3,8 L1.5,6' fill='none'/><path d='M0,-9 L1.5,-6 L1.5,-2 L8,2 L8,4 L1.5,2 L1.5,6 L3,8.5 L0,7.5 L-3,8.5 L-1.5,6 L-1.5,2 L-8,4 L-8,2 L-1.5,-2 L-1.5,-6 Z' fill='#1F3864' stroke='white' stroke-width='0.6'/></svg></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

/**
 * FlightRoute — renders a Polyline for a flight route.
 * If the flight is IN_FLIGHT, renders an animated plane icon at the progress point.
 */
function FlightRoute({ flight, airports = [], simulatedTime }) {
  const originAirport = airports.find(a => a.iata === flight.origin)
  const destAirport = airports.find(a => a.iata === flight.destination)

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
    
    // Compass bearing: 0° = north, 90° = east (clockwise). SVG plane points north at 0°.
    const rot = Math.atan2(lon2 - lon1, lat2 - lat1) * (180 / Math.PI)
    
    // Only show plane when it's clearly between airports (not sitting on origin/destination dot)
    if (!isInFlight || progress < 0.02 || progress > 0.98) return { progressPosition: null, angle: rot }

    return {
      progressPosition: [lerp(lat1, lat2, progress), lerp(lon1, lon2, progress)],
      angle: rot
    }
  }, [isInFlight, progress, originAirport, destAirport])

  if (!originAirport || !destAirport) return null

  const positions = [
    [originAirport.lat, originAirport.lon],
    [destAirport.lat, destAirport.lon],
  ]

  const lineColor = isInFlight ? '#FB8C00' : '#2E75B6'
  const lineWeight = isInFlight ? 1.5 : 1.2
  const lineOpacity = isInFlight ? 0.85 : 0.4
  const dashArray = isInFlight ? '8 6' : '4 6'

  const planeIcon = useMemo(() => createPlaneIcon(angle), [angle])

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
          position={progressPosition}
          icon={planeIcon}
          zIndexOffset={1000}
          eventHandlers={{
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

export default FlightRoute
