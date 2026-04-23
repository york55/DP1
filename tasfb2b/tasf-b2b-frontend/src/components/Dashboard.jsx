import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress, Divider, Alert } from '@mui/material';
import { runALNS } from '../api';
import AssignmentsTable from './AssignmentsTable';
import ObjectiveChart from './ObjectiveChart';

export default function Dashboard({ onSimulationComplete }) {
  const [files, setFiles] = useState({
    aeropuertos: null,
    vuelos: null,
    envios: null,
    parametros: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [solution, setSolution] = useState(null);

  const handleFileChange = (e, key) => {
    setFiles({ ...files, [key]: e.target.files[0] });
  };

  const handleExecute = async () => {
    if (!files.aeropuertos || !files.vuelos || !files.envios || !files.parametros) {
      setError('Por favor, seleccione los 4 archivos CSV.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('aeropuertos', files.aeropuertos);
    formData.append('vuelos', files.vuelos);
    formData.append('envios', files.envios);
    formData.append('parametros', files.parametros);
    formData.append('algoritmo', 'ALNS');

    try {
      const data = await runALNS(formData);
      setSolution(data);
      parseCSV(files.aeropuertos, files.vuelos, data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (airportFile, flightFile, solutionData) => {
    import('papaparse').then(Papa => {
       Papa.default.parse(airportFile, {
           header: true,
           complete: (resultsApt) => {
               const airports = {};
               resultsApt.data.forEach(r => {
                   if (r.idAeropuerto) airports[r.idAeropuerto] = r;
               });
               
               Papa.default.parse(flightFile, {
                   header: true,
                   complete: (resultsFlt) => {
                       onSimulationComplete(solutionData, { airports, flights: resultsFlt.data });
                   }
               });
           }
       });
    });
  };

  const kpis = solution?.kpis;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" color="primary" fontWeight="bold">Panel de Control</Typography>
      <Divider />
      
      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2">Aeropuertos CSV:</Typography>
        <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'aeropuertos')} />
        
        <Typography variant="subtitle2" sx={{mt:1}}>Vuelos CSV:</Typography>
        <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'vuelos')} />

        <Typography variant="subtitle2" sx={{mt:1}}>Envios CSV:</Typography>
        <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'envios')} />

        <Typography variant="subtitle2" sx={{mt:1}}>Escenario (Parámetros) CSV:</Typography>
        <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'parametros')} />
      </Box>

      <Button 
        variant="contained" 
        color="secondary" 
        onClick={handleExecute} 
        disabled={loading}
        sx={{ mt: 2, fontWeight: 'bold' }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Ejecutar ALNS'}
      </Button>

      {kpis && (
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h6" color="primary">KPIs Generales</Typography>
          <Divider />
          <Typography><b>Entregas a tiempo:</b> {(kpis.pctEntregasATiempo * 100).toFixed(1)}%</Typography>
          <Typography><b>Envíos asignados:</b> {(kpis.pctEnviosAsignados * 100).toFixed(1)}%</Typography>
          <Typography><b>Ocupación Promedio Vuelos:</b> {(kpis.ocupacionPromedioVuelos * 100).toFixed(1)}%</Typography>
          <Typography><b>Maletas Retrasadas:</b> {kpis.maletasRetrasadas}</Typography>
        </Box>
      )}

      {solution && (
        <>
           <ObjectiveChart history={solution.obj?.history} />
           <AssignmentsTable assignments={solution.asignaciones} />
        </>
      )}
    </Box>
  );
}
