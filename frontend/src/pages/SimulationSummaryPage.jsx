import React from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HomeIcon from '@mui/icons-material/Home'
import LuggageIcon from '@mui/icons-material/Luggage'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FlightIcon from '@mui/icons-material/Flight'
import WarningIcon from '@mui/icons-material/Warning'
import WorldMap from '../components/map/WorldMap'
import DataTable from '../components/common/DataTable'
import { useSimulationContext } from '../context/SimulationContext'
import { formatUTCFull, formatElapsed } from '../utils/timeUtils'
import { simulationApi } from '../api/simulationApi'

function SummaryStatCard({ icon, label, value, color, bgColor }) {
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        flex: 1,
        minWidth: 130,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {React.cloneElement(icon, { sx: { fontSize: 26, color } })}
      </Box>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: '#6B7280', textAlign: 'center', fontSize: '0.72rem' }}>
        {label}
      </Typography>
    </Paper>
  )
}

const kpiTableColumns = [
  { field: 'label', headerName: 'Indicador', flex: 1 },
  { field: 'value', headerName: 'Valor Final', width: 140 },
  {
    field: 'status',
    headerName: 'Evaluación',
    width: 140,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        sx={{
          backgroundColor: params.row.statusColor + '22',
          color: params.row.statusColor,
          fontWeight: 600,
          fontSize: '0.68rem',
          border: `1px solid ${params.row.statusColor}`,
        }}
      />
    ),
  },
]

export default function SimulationSummaryPage() {
  const navigate = useNavigate()
  const { simulationState, airports, flights, shipments, kpis, resetSimulation } = useSimulationContext()

  const { simulatedTime, elapsedSeconds, config, status } = simulationState

  const handleNewSimulation = async () => {
    try {
      await simulationApi.resetDb()
      resetSimulation()
      navigate('/')
    } catch (err) {
      console.error('Error resetting simulation:', err)
      // En caso de error, intentamos resetear el estado local de todos modos
      resetSimulation()
      navigate('/')
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'idle') {
        navigate('/')
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [status, navigate])

  const total = shipments.length
  const delivered = shipments.filter(s => s.status === 'DELIVERED').length
  const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT').length
  const waiting = shipments.filter(s => s.status === 'IN_ORIGIN').length
  const delayed = shipments.filter(s => s.status === 'DELAYED').length

  const kpiRows = [
    {
      id: 1,
      label: 'Entregas a Tiempo',
      value: `${kpis.onTimeDeliveryPct}%`,
      status: kpis.onTimeDeliveryPct >= 90 ? 'Excelente' : kpis.onTimeDeliveryPct >= 70 ? 'Aceptable' : 'Deficiente',
      statusColor: kpis.onTimeDeliveryPct >= 90 ? '#2E7D32' : kpis.onTimeDeliveryPct >= 70 ? '#FB8C00' : '#C62828',
    },
    {
      id: 2,
      label: 'Ocupación Promedio de Vuelos',
      value: `${kpis.avgFlightOccupancy}%`,
      status: kpis.avgFlightOccupancy >= 70 ? 'Óptimo' : kpis.avgFlightOccupancy >= 45 ? 'Normal' : 'Bajo',
      statusColor: kpis.avgFlightOccupancy >= 70 ? '#2E7D32' : kpis.avgFlightOccupancy >= 45 ? '#FB8C00' : '#C62828',
    },
    {
      id: 3,
      label: 'Ocupación Promedio de Almacenes',
      value: `${kpis.avgWarehouseOccupancy}%`,
      status: kpis.avgWarehouseOccupancy <= 70 ? 'Normal' : kpis.avgWarehouseOccupancy <= 85 ? 'Elevada' : 'Crítica',
      statusColor: kpis.avgWarehouseOccupancy <= 70 ? '#2E7D32' : kpis.avgWarehouseOccupancy <= 85 ? '#FB8C00' : '#C62828',
    },
    {
      id: 4,
      label: 'Maletas Retrasadas',
      value: `${kpis.totalDelayedBags} maletas`,
      status: kpis.totalDelayedBags === 0 ? 'Sin retrasos' : kpis.totalDelayedBags < 50 ? 'Aceptable' : 'Elevado',
      statusColor: kpis.totalDelayedBags === 0 ? '#2E7D32' : kpis.totalDelayedBags < 50 ? '#FB8C00' : '#C62828',
    },
    {
      id: 5,
      label: 'Total de Vuelos Operados',
      value: `${flights.filter(f => f.status !== 'SCHEDULED' && f.status !== 'CANCELLED').length} / ${flights.length}`,
      status: 'Completado',
      statusColor: '#2E75B6',
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F2F2F2', display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: '#1F3864' }}>
        <Toolbar variant="dense">
          <LuggageIcon sx={{ mr: 1, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>
            Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', mx: 2, my: 0.5 }} />
          <Typography variant="body2" sx={{ color: '#90CAF9', fontSize: '0.78rem' }}>
            Resumen de Simulación
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={handleNewSimulation}
            size="small"
            sx={{
              borderColor: '#90CAF9',
              color: '#90CAF9',
              fontSize: '0.75rem',
              '&:hover': { borderColor: '#FFFFFF', color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Nueva Simulación
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3,
            p: 2.5,
            backgroundColor: '#FFFFFF',
            borderRadius: 2,
            boxShadow: 1,
            borderLeft: '5px solid #2E7D32',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 40, color: '#2E7D32' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1F3864' }}>
              Simulación Completada
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Período: {config?.period || '--'} días ·{' '}
              Tiempo simulado final: {simulatedTime ? formatUTCFull(simulatedTime) : '--'} ·{' '}
              Duración real: {formatElapsed(elapsedSeconds || 0)}
            </Typography>
          </Box>
        </Box>

        {/* Summary stat cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <SummaryStatCard
            icon={<LocalShippingIcon />}
            label="Total de Envíos"
            value={total}
            color="#1F3864"
            bgColor="#E8EEF7"
          />
          <SummaryStatCard
            icon={<CheckCircleIcon />}
            label="Entregados"
            value={delivered}
            color="#2E7D32"
            bgColor="#E8F5E9"
          />
          <SummaryStatCard
            icon={<FlightIcon />}
            label="En Tránsito"
            value={inTransit}
            color="#FB8C00"
            bgColor="#FFF3E0"
          />
          <SummaryStatCard
            icon={<LuggageIcon />}
            label="En Espera"
            value={waiting}
            color="#2E75B6"
            bgColor="#E3F2FD"
          />
          <SummaryStatCard
            icon={<WarningIcon />}
            label="Retrasados"
            value={delayed}
            color="#C62828"
            bgColor="#FFEBEE"
          />
        </Box>

        {/* Map + KPIs side by side */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, height: 380 }}>
          {/* Final Map */}
          <Box sx={{ flex: '0 0 60%', borderRadius: 2, overflow: 'hidden', boxShadow: 2 }}>
            <WorldMap airports={airports} flights={flights} simulatedTime={simulatedTime} />
          </Box>

          {/* KPI Table */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={2} sx={{ p: 2, flex: 1, borderRadius: 2, overflow: 'auto' }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, color: '#1F3864', mb: 1.5 }}
              >
                KPIs Finales
              </Typography>
              <DataTable
                rows={kpiRows}
                columns={kpiTableColumns}
                sx={{ '& .MuiDataGrid-root': { border: 'none' } }}
              />
            </Paper>
          </Box>
        </Box>

        {/* Call to action */}
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<HomeIcon />}
            onClick={handleNewSimulation}
            sx={{
              backgroundColor: '#1F3864',
              fontWeight: 700,
              px: 5,
              py: 1.5,
              fontSize: '0.95rem',
              '&:hover': { backgroundColor: '#162D4F' },
            }}
          >
            Nueva Simulación
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
