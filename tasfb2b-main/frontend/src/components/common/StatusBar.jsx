import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import { useSimulationContext } from '../../context/SimulationContext'

const PHASE_LABELS = {
  GREEDY_INIT: 'Inicializando',
  OPTIMIZING: 'Optimizando',
  COMPLETE: 'Completado',
}

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

function PlanningBar({ progress }) {
  const { phase, iteration, maxIterations, assignedBatches, totalBatches } = progress
  const pct = maxIterations > 0
    ? phase === 'GREEDY_INIT' ? 2
    : phase === 'COMPLETE' ? 100
    : Math.round((iteration / maxIterations) * 100)
    : 0
  const phaseLabel = PHASE_LABELS[phase] || 'Planificando'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
      <Typography variant="caption" sx={{ color: '#90CAF9', fontWeight: 700, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
        ALNS
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <Typography variant="caption" sx={{ color: '#BFBFBF', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
        {phaseLabel}
      </Typography>
      <Box sx={{ flex: 1, maxWidth: 160 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#2E75B6',
            '& .MuiLinearProgress-bar': {
              backgroundColor: phase === 'COMPLETE' ? '#66BB6A' : '#90CAF9',
              borderRadius: 3,
            },
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', minWidth: 32 }}>
        {pct}%
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="Iter" value={`${iteration}/${maxIterations}`} color="#90CAF9" />
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
      <StatItem label="Asignados" value={`${assignedBatches}/${totalBatches}`} color="#66BB6A" />
    </Box>
  )
}

export default function StatusBar() {
  const { shipments, shipmentCounts, simulationState, planningProgress } = useSimulationContext()
  const isPlanning = simulationState?.status === 'planning'

  const total = shipments.length
  const delivered = shipmentCounts?.DELIVERED ?? shipments.filter(s => s.status === 'DELIVERED').length
  const inTransit = shipmentCounts?.IN_TRANSIT ?? shipments.filter(s => s.status === 'IN_TRANSIT').length
  const planned   = shipmentCounts?.IN_ORIGIN  ?? shipments.filter(s => s.status === 'IN_ORIGIN').length
  const delayed   = shipmentCounts?.DELAYED    ?? shipments.filter(s => s.status === 'DELAYED').length

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
      <Typography variant="caption" sx={{ color: '#90CAF9', fontWeight: 700, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
        {isPlanning ? 'PLANIFICANDO' : 'ENVÍOS'}
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

      {isPlanning ? (
        <PlanningBar progress={planningProgress} />
      ) : (
        <>
          <StatItem label="Total" value={total} color="#FFFFFF" />
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
          <StatItem label="Entregados" value={delivered} color="#66BB6A" />
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
          <StatItem label="En Tránsito" value={inTransit} color="#FB8C00" />
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
          <StatItem label="En Espera" value={planned} color="#90CAF9" />
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />
          <StatItem label="Retrasados" value={delayed} color="#EF9A9A" />
        </>
      )}
    </Box>
  )
}
