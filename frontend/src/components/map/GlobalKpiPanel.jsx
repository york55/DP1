import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AssessmentIcon from '@mui/icons-material/Assessment'
import FlightIcon from '@mui/icons-material/Flight'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import { getSemaphoreLevel } from '../../utils/semaphoreUtils'

/**
 * SemaphoreBar — compact horizontal bar with semaphore color fill.
 */
function SemaphoreBar({ pct, color }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: 8, borderRadius: 4, backgroundColor: '#E0E0E0', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute', top: 0, left: 0,
          height: '100%',
          width: `${Math.min(100, Math.max(0, pct))}%`,
          backgroundColor: color,
          borderRadius: 4,
          transition: 'width 0.6s ease, background-color 0.6s ease',
        }}
      />
    </Box>
  )
}

/**
 * KpiRow — single global KPI: icon + label + percentage + semaphore bar + semaphore dot.
 */
function KpiRow({ icon, label, pct }) {
  const sem = getSemaphoreLevel(pct)
  const displayPct = pct.toFixed(1)

  return (
    <Box sx={{ mb: 1.25 }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        {icon}
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1F3864', flex: 1 }}>
          {label}
        </Typography>
        {/* Semaphore dot */}
        <Box sx={{
          width: 10, height: 10, borderRadius: '50%',
          backgroundColor: sem.color,
          border: '1px solid rgba(0,0,0,0.15)',
          flexShrink: 0,
        }} />
      </Box>

      {/* Value + bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <SemaphoreBar pct={pct} color={sem.color} />
        </Box>
        <Typography sx={{
          fontSize: '0.72rem', fontWeight: 700,
          color: sem.color,
          minWidth: 42, textAlign: 'right',
          fontFamily: 'monospace',
        }}>
          {displayPct}%
        </Typography>
      </Box>

      {/* Semaphore label */}
      <Typography sx={{
        fontSize: '0.58rem', fontWeight: 600,
        color: sem.color,
        mt: 0.25,
      }}>
        {sem.label}
      </Typography>
    </Box>
  )
}

/**
 * GlobalKpiPanel — floating button + expandable panel showing global fleet
 * and warehouse occupancy with semaphore indicators.
 *
 * Props:
 *   avgFlightOccupancy:    number (0–100) — global fleet occupancy %
 *   avgWarehouseOccupancy: number (0–100) — global warehouse occupancy %
 */
export default function GlobalKpiPanel({ avgFlightOccupancy = 0, avgWarehouseOccupancy = 0, open: openProp, onToggle }) {
  // Controlled by the parent (to keep a single panel open at a time) when
  // open/onToggle are provided; falls back to local state otherwise.
  const [localOpen, setLocalOpen] = useState(false)
  const open = onToggle ? openProp : localOpen
  const toggle = onToggle || (() => setLocalOpen(o => !o))

  // Determine the "worst" semaphore between both for the button dot color
  const fleetSem = getSemaphoreLevel(avgFlightOccupancy)
  const whSem = getSemaphoreLevel(avgWarehouseOccupancy)
  const worstSeverity = Math.max(fleetSem.severity, whSem.severity)
  const worstColor = worstSeverity === fleetSem.severity ? fleetSem.color : whSem.color

  return (
    <Box sx={{ position: 'absolute', top: 116, left: 11, zIndex: 1000 }}>
      {/* Toggle button */}
      <Tooltip title="Indicadores globales" placement="right">
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <Paper
            elevation={2}
            sx={{
              borderRadius: '4px', overflow: 'hidden',
              backgroundColor: open ? '#1F3864' : '#fff',
            }}
          >
            <IconButton
              size="small"
              onClick={toggle}
              sx={{ color: open ? '#fff' : '#333', p: '6px' }}
            >
              <AssessmentIcon fontSize="small" />
            </IconButton>
          </Paper>
          {/* Semaphore dot indicator on the button */}
          <Box sx={{
            position: 'absolute', top: -4, right: -4,
            width: 12, height: 12, borderRadius: '50%',
            backgroundColor: worstColor,
            border: '1.5px solid #fff',
            pointerEvents: 'none',
            boxShadow: '0 0 3px rgba(0,0,0,0.3)',
          }} />
        </Box>
      </Tooltip>

      {/* Expanded panel */}
      {open && (
        <Paper
          elevation={4}
          sx={{
            mt: -4, p: 1.5, ml: 5,
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderRadius: 1.5, width: 210,
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Title */}
          <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#1F3864', mb: 1.25 }}>
            Indicadores globales
          </Typography>

          {/* Fleet occupancy */}
          <KpiRow
            icon={<FlightIcon sx={{ fontSize: 14, color: '#1F3864' }} />}
            label="Ocupación de flota"
            pct={avgFlightOccupancy}
          />

          {/* Divider */}
          <Box sx={{ borderTop: '1px solid #eee', my: 1 }} />

          {/* Warehouse occupancy */}
          <KpiRow
            icon={<WarehouseIcon sx={{ fontSize: 14, color: '#1F3864' }} />}
            label="Ocupación de almacenes"
            pct={avgWarehouseOccupancy}
          />
        </Paper>
      )}
    </Box>
  )
}
