import React, { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import Box from '@mui/material/Box'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import MapLegend from './MapLegend'

// Triggers Leaflet's invalidateSize() whenever `trigger` changes, fixing gray
// zones that appear after the map's container is resized (e.g. sidebar collapse).
function MapResizer({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [trigger, map])
  return null
}

/**
 * WorldMap — renders the full interactive world map with airports and flight routes.
 * @param {Array} airports - array of airport objects (with live occupancy)
 * @param {Array} flights - array of flight objects
 * @param {Date|null} simulatedTime - current simulated time for progress calculation
 * @param {*} resizeTrigger - any value whose change signals a container resize
 */
function WorldMap({ airports = [], flights = [], simulatedTime = null, resizeTrigger }) {
  // OPTIMIZATION: Only show IN_FLIGHT routes to avoid massive lag with 800+ polylines.
  // Rendering all scheduled flights makes Leaflet extremely slow.
  const visibleFlights = useMemo(() =>
    flights.filter(f => f.status === 'IN_FLIGHT'),
    [flights]
  )

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-85.051129, -180], [85.051129, 180]]}
        maxBoundsViscosity={1.0}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          noWrap={true}
        />
        <MapResizer trigger={resizeTrigger} />

        {/* Flight routes and Planes */}
        {visibleFlights.map(flight => (
          <FlightRoute
            key={flight.id}
            flight={flight}
            airports={airports}
            simulatedTime={simulatedTime}
          />
        ))}

        {/* Airport markers */}
        {airports.map(airport => (
          <AirportMarker
            key={airport.iata}
            airport={airport}
            flights={flights}
          />
        ))}
      </MapContainer>

      {/* Legend (absolute positioned over map) */}
      <MapLegend />
    </Box>
  )
}

export default React.memo(WorldMap)
