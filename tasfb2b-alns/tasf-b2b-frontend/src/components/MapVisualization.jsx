import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import { Box } from '@mui/material';

function ChangeView({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export default function MapVisualization({ data, solution }) {
  const { airports } = data;
  
  const hasAirports = airports && Object.keys(airports).length > 0;
  
  const bounds = [];
  if (hasAirports) {
    Object.values(airports).forEach(apt => {
        if (apt.latitud && apt.longitud) {
            bounds.push([parseFloat(apt.latitud), parseFloat(apt.longitud)]);
        }
    });
  }

  const renderRoutes = () => {
    if (!solution || !solution.asignaciones) return null;
    
    return solution.asignaciones.map((asig, i) => {
        if (asig.estado === 'ASSIGNED' && asig.ruta && asig.ruta.vuelos) {
            return asig.ruta.vuelos.map((vuelo, j) => {
                const origen = airports[vuelo.iataOrigen];
                const destino = airports[vuelo.iataDestino];
                if (origen && destino) {
                    const positions = [
                        [parseFloat(origen.latitud), parseFloat(origen.longitud)],
                        [parseFloat(destino.latitud), parseFloat(destino.longitud)]
                    ];
                    return <Polyline key={`route-${i}-${j}`} positions={positions} color="#D44424" weight={2} opacity={0.5} />;
                }
                return null;
            });
        }
        return null;
    });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', backgroundColor: '#e0e0e0' }}>
      <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds.length > 0 && <ChangeView bounds={bounds} />}
        
        {hasAirports && Object.values(airports).map(apt => {
            if (!apt.latitud || !apt.longitud) return null;
            return (
              <CircleMarker 
                  key={apt.idAeropuerto}
                  center={[parseFloat(apt.latitud), parseFloat(apt.longitud)]}
                  radius={5}
                  color="#041B44"
                  fillOpacity={0.8}
              >
                  <Popup>
                      <b>{apt.idAeropuerto}</b><br/>
                      {apt.ciudad}, {apt.pais}<br/>
                      Capacidad: {apt.capacidadMaxima}
                  </Popup>
              </CircleMarker>
            );
        })}

        {renderRoutes()}
      </MapContainer>
    </Box>
  );
}
