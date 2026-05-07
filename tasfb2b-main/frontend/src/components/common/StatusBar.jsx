import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { useSimulationContext } from '../../context/SimulationContext'

function StatItem({ label, value, color = 'text.primary' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {label}:
      </Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.7rem' }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function StatusBar() {
  const { shipments } = useSimulationContext()

  const total = shipments.length
  const delivered = shipments.filter(s => s.status === 'DELIVERED').length
  const inFlight = shipments.filter(s => s.status === 'IN_FLIGHT').length
  const inOrigin = shipments.filter(s => s.status === 'IN_ORIGIN').length
  const delayed = shipments.filter(s => s.status === 'DELAYED').length

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        backgroundColor: '#1F3864',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 2,
        zIndex: 1200,
      }}
    >
      <Typography variant="caption" sx={{ color: '#90CAF9', fontWeight: 700, fontSize: '0.7rem' }}>
        ENVÍOS
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="Total" value={total} color="#FFFFFF" />
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="Entregados" value={delivered} color="#66BB6A" />
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="En Tránsito" value={inFlight} color="#FB8C00" />
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="En Espera" value={inOrigin} color="#90CAF9" />
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="Retrasados" value={delayed} color="#EF9A9A" />
    </Box>
  )
}
