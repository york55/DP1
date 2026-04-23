import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography } from '@mui/material';

export default function ObjectiveChart({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <Box sx={{ width: '100%', height: 300, mt: 2 }}>
      <Typography variant="h6" color="primary" gutterBottom>Evolución de la Función Objetivo</Typography>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="iteration" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="currentF" stroke="#8884d8" name="Actual" dot={false} />
          <Line type="monotone" dataKey="bestF" stroke="#D44424" name="Mejor Global" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
