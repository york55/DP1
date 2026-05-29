import React, { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { useSimulationContext } from '../../context/SimulationContext'
import { getRecentLogs } from '../../utils/logger'
import client from '../../api/client'

export const FOOTER_H = 36

const PANEL_H = 300
const POLL_BACKEND_MS = 3000
const POLL_FRONTEND_MS = 1000

const LEVEL_COLOR = {
  ERROR:   '#EF9A9A',
  WARN:    '#FFCC80',
  WARNING: '#FFCC80',
  INFO:    '#90CAF9',
  DEBUG:   '#B0BEC5',
}

const PHASE_LABELS = {
  GREEDY_INIT: 'Inicialización greedy',
  OPTIMIZING:  'Optimizando (ALNS)',
  COMPLETE:    'Planificación completa',
}

function LogLine({ entry }) {
  const ts = entry.timestamp ? entry.timestamp.substring(11, 23) : ''
  const color = LEVEL_COLOR[entry.level?.toUpperCase()] || '#B0BEC5'
  return (
    <Box sx={{
      display: 'flex', gap: 1, py: '2px', px: 1,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
    }}>
      <Typography sx={{ color: '#546E7A', fontSize: '0.65rem', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {ts}
      </Typography>
      <Typography sx={{ color, fontWeight: 700, fontSize: '0.65rem', fontFamily: 'monospace', whiteSpace: 'nowrap', minWidth: 38, flexShrink: 0 }}>
        {entry.level}
      </Typography>
      <Typography sx={{ color: '#607D8B', fontSize: '0.65rem', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        [{entry.source}]
      </Typography>
      <Typography sx={{ color: '#ECEFF1', fontSize: '0.65rem', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4 }}>
        {entry.message}
      </Typography>
    </Box>
  )
}

function LogPanel({ logs }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [logs])

  if (logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#546E7A' }}>
        <Typography variant="caption">Sin logs todavía…</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowY: 'auto', height: '100%' }}>
      {logs.map((e, i) => <LogLine key={i} entry={e} />)}
      <div ref={bottomRef} />
    </Box>
  )
}

function PlanningPanel({ progress }) {
  const { phase, iteration, maxIterations, assignedBatches, totalBatches, currentObjective } = progress
  const pct = maxIterations > 0
    ? phase === 'GREEDY_INIT' ? 2
    : phase === 'COMPLETE' ? 100
    : Math.round((iteration / maxIterations) * 100)
    : 0
  const phaseLabel = PHASE_LABELS[phase] || (phase ? phase : 'Esperando inicio…')
  const isComplete = phase === 'COMPLETE'
  const barColor = isComplete ? '#66BB6A' : '#90CAF9'

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ color: '#90CAF9', fontSize: '0.75rem', fontWeight: 700 }}>
            {phaseLabel}
          </Typography>
          <Typography sx={{ color: barColor, fontSize: '0.75rem', fontWeight: 700 }}>
            {pct}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8, borderRadius: 4,
            backgroundColor: '#1E3A5F',
            '& .MuiLinearProgress-bar': { backgroundColor: barColor, borderRadius: 4 },
          }}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {[
          { label: 'Iteración actual', value: `${iteration} / ${maxIterations}`, color: '#90CAF9' },
          { label: 'Lotes asignados', value: `${assignedBatches} / ${totalBatches}`, color: '#66BB6A' },
          { label: 'Objetivo actual', value: currentObjective != null ? currentObjective.toFixed(2) : '—', color: '#FFCC80' },
          { label: 'Fase', value: phase || '—', color: '#B0BEC5' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ color: '#607D8B', fontSize: '0.65rem', mb: 0.25 }}>{label}</Typography>
            <Typography sx={{ color, fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {isComplete && (
        <Box sx={{ backgroundColor: 'rgba(102,187,106,0.1)', border: '1px solid #66BB6A', borderRadius: 1, p: 1.5 }}>
          <Typography sx={{ color: '#66BB6A', fontSize: '0.75rem', fontWeight: 700 }}>
            Planificación completada — la simulación comenzará en breve.
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function StatusSummary({ simulationState, shipments, shipmentCounts, planningProgress }) {
  const { status } = simulationState || {}
  const isPlanning = status === 'planning'

  if (isPlanning) {
    const { phase, iteration, maxIterations } = planningProgress
    const pct = maxIterations > 0
      ? phase === 'GREEDY_INIT' ? 2
      : phase === 'COMPLETE' ? 100
      : Math.round((iteration / maxIterations) * 100)
      : 0
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#90CAF9', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
          PLANIFICANDO
        </Typography>
        <Box sx={{ flex: 1, maxWidth: 120 }}>
          <LinearProgress variant="determinate" value={pct} sx={{
            height: 5, borderRadius: 3,
            backgroundColor: '#2E4A7A',
            '& .MuiLinearProgress-bar': { backgroundColor: '#90CAF9' },
          }} />
        </Box>
        <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontFamily: 'monospace' }}>{pct}%</Typography>
        <Typography sx={{ color: '#607D8B', fontSize: '0.65rem' }}>iter {iteration}/{maxIterations}</Typography>
      </Box>
    )
  }

  const hasCounts = shipmentCounts && Object.keys(shipmentCounts).length > 0
  if (!hasCounts && !shipments?.length) return null

  const counts = {
    delivered: shipmentCounts?.DELIVERED  ?? shipments.filter(s => s.status === 'DELIVERED').length,
    transit:   shipmentCounts?.IN_TRANSIT ?? shipments.filter(s => s.status === 'IN_TRANSIT').length,
    planned:   shipmentCounts?.IN_ORIGIN  ?? shipments.filter(s => s.status === 'IN_ORIGIN').length,
    delayed:   shipmentCounts?.DELAYED    ?? shipments.filter(s => s.status === 'DELAYED').length,
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
      {[
        { label: 'Entregados', val: counts.delivered, color: '#66BB6A' },
        { label: 'Tránsito',   val: counts.transit,   color: '#FB8C00' },
        { label: 'Espera',     val: counts.planned,   color: '#90CAF9' },
        { label: 'Retrasados', val: counts.delayed,   color: '#EF9A9A' },
      ].map(({ label, val, color }, i) => (
        <React.Fragment key={label}>
          {i > 0 && <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E4A7A', my: 0.5 }} />}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ color: '#607D8B', fontSize: '0.65rem' }}>{label}:</Typography>
            <Typography sx={{ color, fontSize: '0.65rem', fontWeight: 700 }}>{val}</Typography>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  )
}

const TABS = ['Backend', 'Frontend', 'Planificación']

export default function DevFooter() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const [backendLogs, setBackendLogs] = useState([])
  const [frontendLogs, setFrontendLogs] = useState([])
  const { planningProgress, simulationState, shipments, shipmentCounts } = useSimulationContext()

  const fetchBackend = useCallback(async () => {
    try {
      const res = await client.get('/logs/recent?limit=200')
      setBackendLogs(res.data.backend || [])
    } catch { /* silent */ }
  }, [])

  // Poll backend logs when tab is open on backend tab
  useEffect(() => {
    if (!open || tab !== 0) return
    fetchBackend()
    const id = setInterval(fetchBackend, POLL_BACKEND_MS)
    return () => clearInterval(id)
  }, [open, tab, fetchBackend])

  // Poll frontend logs from in-memory buffer
  useEffect(() => {
    if (!open || tab !== 1) return
    const update = () => setFrontendLogs([...getRecentLogs(200)])
    update()
    const id = setInterval(update, POLL_FRONTEND_MS)
    return () => clearInterval(id)
  }, [open, tab])

  // Fetch backend once when opening on that tab
  useEffect(() => {
    if (open && tab === 0) fetchBackend()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabClick(idx) {
    if (!open) setOpen(true)
    setTab(idx)
  }

  const logsForCurrentTab = tab === 0 ? backendLogs : frontendLogs

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1250,
        backgroundColor: '#0D1B2A',
        borderTop: '1px solid #1E3A5F',
        transition: 'height 0.2s ease',
        height: open ? PANEL_H + FOOTER_H : FOOTER_H,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header strip — always visible */}
      <Box
        sx={{
          height: FOOTER_H,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 1,
          borderBottom: open ? '1px solid #1E3A5F' : 'none',
        }}
      >
        {/* Toggle */}
        <Tooltip title={open ? 'Cerrar consola' : 'Abrir consola'}>
          <IconButton size="small" onClick={() => setOpen(v => !v)} sx={{ color: '#546E7A', p: 0.25 }}>
            {open ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ExpandLessIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        <Typography sx={{ color: '#546E7A', fontSize: '0.65rem', fontWeight: 700, mr: 0.5, userSelect: 'none' }}>
          LOGS
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ borderColor: '#1E3A5F', my: 0.5 }} />

        {/* Tab pills */}
        {TABS.map((label, idx) => (
          <Box
            key={label}
            onClick={() => handleTabClick(idx)}
            sx={{
              px: 1, py: 0.25, borderRadius: '3px', cursor: 'pointer', userSelect: 'none',
              backgroundColor: open && tab === idx ? '#1E3A5F' : 'transparent',
              color: open && tab === idx ? '#90CAF9' : '#546E7A',
              fontSize: '0.65rem', fontWeight: 700,
              '&:hover': { color: '#90CAF9', backgroundColor: 'rgba(30,58,95,0.5)' },
              transition: 'all 0.15s',
            }}
          >
            {label}
          </Box>
        ))}

        <Divider orientation="vertical" flexItem sx={{ borderColor: '#1E3A5F', my: 0.5 }} />

        {/* Status summary (right side) */}
        <StatusSummary
          simulationState={simulationState}
          shipments={shipments}
          shipmentCounts={shipmentCounts}
          planningProgress={planningProgress}
        />

        {/* Clear button (only for log tabs) */}
        {open && tab < 2 && (
          <Tooltip title="Limpiar logs">
            <IconButton
              size="small"
              onClick={() => tab === 0 ? setBackendLogs([]) : setFrontendLogs([])}
              sx={{ color: '#546E7A', p: 0.25, ml: 'auto', '&:hover': { color: '#EF9A9A' } }}
            >
              <DeleteSweepIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Content area */}
      {open && (
        <Box sx={{ flex: 1, overflow: 'hidden', backgroundColor: '#0A1628' }}>
          {tab < 2 ? (
            <LogPanel logs={logsForCurrentTab} />
          ) : (
            <PlanningPanel progress={planningProgress} />
          )}
        </Box>
      )}
    </Box>
  )
}
