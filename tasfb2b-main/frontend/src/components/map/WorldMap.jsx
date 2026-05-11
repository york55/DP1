import React, { useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import Box from '@mui/material/Box'
import AirportMarker from './AirportMarker'
import FlightRoute from './FlightRoute'
import MapLegend from './MapLegend'

/**
 * WorldMap — renders the full interactive world map with airports and flight routes.
 * @param {Array} airports - array of airport objects (with live occupancy)
 * @param {Array} flights - array of flight objects
 * @param {Date|null} simulatedTime - current simulated time for progress calculation
 */
function WorldMap({ airports = [], flights = [], simulatedTime = null }) {
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
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

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
