import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import { getSemaphoreColor } from '../../utils/semaphoreUtils'

export default function FlightMapPopup({ flight }) {
  const bags = flight.bagsAboard ?? flight.assignedBags ?? 0
  const cap = flight.capacity ?? 0
  const pct = cap > 0 ? (bags / cap) * 100 : 0
  const color = getSemaphoreColor(pct)

  const barColor = color === 'red' ? '#C62828' : color === 'orange' ? '#E65100' : color === 'yellow' ? '#FB8C00' : '#66BB6A'

  return (
    <Box sx={{ minWidth: 170, fontFamily: '"Roboto", sans-serif' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1F3864', lineHeight: 1.2 }}>
        {flight.origin} → {flight.destination}
      </Typography>
      {flight.flightCode && (
        <Typography sx={{ fontSize: 10, color: '#6B7280' }}>{flight.flightCode}</Typography>
      )}

      <Divider sx={{ my: 0.5 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography sx={{ fontSize: 10, color: '#6B7280' }}>Carga</Typography>
        <Typography sx={{ fontSize: 10, fontWeight: 600 }}>{bags} / {cap} maletas</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{
          height: 5,
          borderRadius: 3,
          backgroundColor: '#E0E0E0',
          '& .MuiLinearProgress-bar': { backgroundColor: barColor },
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={{ fontSize: 10, color: '#6B7280' }}>Utilización</Typography>
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: barColor }}>{pct.toFixed(1)}%</Typography>
      </Box>
    </Box>
  )
}
