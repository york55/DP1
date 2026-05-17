import React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import KpiCard from './KpiCard'
import { useSimulationContext } from '../../context/SimulationContext'

export default function KpiPanel() {
  const { kpis = {} } = useSimulationContext()

  const {
    onTimeDeliveryPct = 100,
    avgFlightOccupancy = 0,
    avgWarehouseOccupancy = 0,
    totalDelayedBags = 0,
  } = kpis

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: '#1F3864', fontWeight: 700 }}>
        Indicadores Clave de Rendimiento
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
        }}
      >
        <KpiCard
          label="Entregas a Tiempo"
          value={onTimeDeliveryPct}
          unit="%"
          trend={onTimeDeliveryPct >= 90 ? 'up' : onTimeDeliveryPct >= 70 ? 'neutral' : 'down'}
          color="#2E7D32"
        />
        <KpiCard
          label="Ocupación Vuelos (Prom.)"
          value={avgFlightOccupancy}
          unit="%"
          trend={avgFlightOccupancy > 80 ? 'up' : avgFlightOccupancy > 50 ? 'neutral' : 'down'}
          color="#2E75B6"
        />
        <KpiCard
          label="Ocupación Almacén (Prom.)"
          value={avgWarehouseOccupancy}
          unit="%"
          trend={avgWarehouseOccupancy > 80 ? 'down' : avgWarehouseOccupancy > 50 ? 'neutral' : 'up'}
          color="#FB8C00"
        />
        <KpiCard
          label="Maletas Retrasadas"
          value={totalDelayedBags}
          unit="maletas"
          trend={totalDelayedBags === 0 ? 'up' : totalDelayedBags < 50 ? 'neutral' : 'down'}
          color="#C62828"
        />
      </Box>
    </Box>
  )
}
