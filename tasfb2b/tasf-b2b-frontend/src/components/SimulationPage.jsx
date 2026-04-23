import React, { useState } from 'react';
import { Box, Paper } from '@mui/material';
import MapVisualization from './MapVisualization';
import Dashboard from './Dashboard';

export default function SimulationPage() {
  const [simulationData, setSimulationData] = useState(null);
  const [mapData, setMapData] = useState({ flights: [], airports: {} });

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex' }}>
      <Box sx={{ width: '70%', height: '100%', position: 'relative' }}>
        <MapVisualization data={mapData} solution={simulationData} />
      </Box>
      <Paper sx={{ width: '30%', height: '100%', overflow: 'auto', p: 2, zIndex: 1 }} elevation={3} square>
        <Dashboard 
          onSimulationComplete={(res, mapData) => {
            setSimulationData(res);
            setMapData(mapData);
          }} 
        />
      </Paper>
    </Box>
  );
}
