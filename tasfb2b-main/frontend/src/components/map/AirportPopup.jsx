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
  const { iata, city, country, maxCapacity, occupancy } = airport
  const currentBags = Math.round((occupancy / 100) * maxCapacity)

  return (
    <Box sx={{ minWidth: 200, fontFamily: '"Roboto", sans-serif' }}>
      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography
          sx={{ fontSize: 22, fontWeight: 700, color: '#1F3864', lineHeight: 1 }}
        >
          {iata}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
          {city}, {country}
        </Typography>
      </Box>

      <Divider sx={{ my: 0.75 }} />

      {/* Semaphore */}
      <Box sx={{ mb: 1 }}>
        <SemaphoreChip occupancyPct={occupancy} />
      </Box>

      {/* Capacity bar */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
          <Typography sx={{ fontSize: 11, color: '#6B7280' }}>Capacidad</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
            {currentBags} / {maxCapacity} maletas
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(occupancy, 100)}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#E0E0E0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: occupancy >= 90 ? '#C62828' : occupancy >= 75 ? '#E65100' : occupancy >= 50 ? '#FB8C00' : '#66BB6A',
            },
          }}
        />
      </Box>

      <Divider sx={{ my: 0.75 }} />

      {/* Flight counts */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1F3864' }}>
            {incomingCount}
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#6B7280' }}>Vuelos entrada</Typography>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1F3864' }}>
            {outgoingCount}
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#6B7280' }}>Vuelos salida</Typography>
        </Box>
      </Box>
    </Box>
  )
}
