import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography } from '@mui/material';

export default function AssignmentsTable({ assignments }) {
  if (!assignments || assignments.length === 0) return null;

  const columns = [
    { field: 'idEnvio', headerName: 'ID Envío', width: 130 },
    { field: 'estado', headerName: 'Estado', width: 130 },
    { field: 'vuelos', headerName: 'Ruta (Vuelos)', width: 250, valueGetter: (value, row) => {
        if (!row.ruta || !row.ruta.vuelos) return 'N/A';
        return row.ruta.vuelos.map(v => v.idVuelo).join(' -> ');
    }},
    { field: 'retrasoMinutos', headerName: 'Retraso (min)', type: 'number', width: 130 },
  ];

  const rows = assignments.map((a, i) => ({ id: i, ...a }));

  return (
    <Box sx={{ height: 400, width: '100%', mt: 2 }}>
      <Typography variant="h6" color="primary" gutterBottom>Asignaciones (Detalle)</Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[5, 10, 25]}
        initialState={{
          pagination: { paginationModel: { pageSize: 5 } },
        }}
        density="compact"
      />
    </Box>
  );
}
