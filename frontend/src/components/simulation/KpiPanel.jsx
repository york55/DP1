import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import KpiCard from './KpiCard'
import KpiSemaphoreCard from '../common/KpiSemaphoreCard'
import { useSimulationContext } from '../../context/SimulationContext'

export default function KpiPanel() {
  const { kpis = {} } = useSimulationContext()

  const {
    onTimeDeliveryPct = 100,
    avgFlightOccupancy = 0,
    avgWarehouseOccupancy = 0,
    totalDelayedBags = 0,
    totalBags = 0,
    deliveredBags = 0,
    inTransitBags = 0,
    waitingBags = 0,
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
        <KpiSemaphoreCard
          label="Ocupación Vuelos (Prom.)"
          occupancyPct={avgFlightOccupancy}
        />
        <KpiSemaphoreCard
          label="Ocupación Almacén (Prom.)"
          occupancyPct={avgWarehouseOccupancy}
        />
        <KpiCard
          label="Maletas Retrasadas"
          value={totalDelayedBags}
          unit="maletas"
          trend={totalDelayedBags === 0 ? 'up' : totalDelayedBags < 50 ? 'neutral' : 'down'}
          color="#C62828"
        />
      </Box>

      {/* Live bag counters */}
      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1.5, color: '#1F3864', fontWeight: 700 }}>
        Estado de Maletas (Tiempo Real)
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
        }}
      >
        <KpiCard label="Total Maletas" value={totalBags} unit="" color="#37474F" trend="neutral" />
        <KpiCard
          label="En Almacén"
          value={waitingBags}
          unit=""
          color="#1565C0"
          trend={waitingBags > 0 ? 'neutral' : 'up'}
        />
        <KpiCard
          label="En Tránsito"
          value={inTransitBags}
          unit=""
          color="#E65100"
          trend={inTransitBags > 0 ? 'up' : 'neutral'}
        />
        <KpiCard
          label="Entregadas"
          value={deliveredBags}
          unit=""
          color="#2E7D32"
          trend={deliveredBags > 0 ? 'up' : 'neutral'}
        />
      </Box>
    </Box>
  )
}
