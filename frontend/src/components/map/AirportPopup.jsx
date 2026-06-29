import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import SemaphoreChip from '../common/SemaphoreChip'

/**
 * AirportPopup — content rendered inside a Leaflet Popup.
 * Must be MUI-styled but works inside Leaflet's DOM.
 */
export default function AirportPopup({ airport, incomingCount = 0, outgoingCount = 0 }) {
  const { iata, city, country, warehouseCapacity, currentOccupancy, occupancy } = airport
  const maxCapacity = warehouseCapacity ?? 0
  const currentBags = currentOccupancy ?? Math.round((occupancy / 100) * maxCapacity)

  return (
    <Box sx={{ minWidth: 180, fontFamily: '"Roboto", sans-serif' }}>
      {/* Header */}
      <Box sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#1F3864', lineHeight: 1 }}>
          {iata}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#6B7280' }}>
          {city}, {country}
        </Typography>
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {/* Semaphore + Capacity bar */}
      <Box sx={{ mb: 0.5 }}>
        <Box sx={{ mb: 0.5 }}>
          <SemaphoreChip occupancyPct={occupancy} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
          <Typography sx={{ fontSize: 10, color: '#6B7280' }}>Capacidad</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 600 }}>
            {currentBags} / {maxCapacity > 0 ? maxCapacity : '—'} maletas ({occupancy.toFixed(1)}%)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(occupancy, 100)}
          sx={{
            height: 5,
            borderRadius: 3,
            backgroundColor: '#E0E0E0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: occupancy >= 90 ? '#C62828' : occupancy >= 75 ? '#E65100' : occupancy >= 50 ? '#FB8C00' : '#66BB6A',
            },
          }}
        />
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {/* Flight counts */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1F3864' }}>
            {incomingCount}
          </Typography>
          <Typography sx={{ fontSize: 9, color: '#6B7280' }}>Vuelos entrada</Typography>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1F3864' }}>
            {outgoingCount}
          </Typography>
          <Typography sx={{ fontSize: 9, color: '#6B7280' }}>Vuelos salida</Typography>
        </Box>
      </Box>
    </Box>
  )
}
