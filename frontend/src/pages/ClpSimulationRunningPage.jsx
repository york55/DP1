import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import WarningIcon from '@mui/icons-material/Warning'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import WorldMap from '../components/map/WorldMap'
import NotificationStack from '../components/common/NotificationStack'
import { useClpSimulationContext } from '../context/ClpSimulationContext'
import { formatElapsed } from '../utils/timeUtils'

function fmtSimDate(d) {
  if (!d) return '-- --- ----'
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2,'0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
function fmtSimTime(d) {
  if (!d) return '--:--:-- UTC'
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} UTC`
}

const STATUS_LABELS = {
  planning: { label: 'Planificando...', color: '#92400E', bg: '#FEF3C7' },
  running:  { label: 'En Ejecución', color: '#2E7D32', bg: '#E8F5E9' },
  paused:   { label: 'Pausada', color: '#E65100', bg: '#FFF3E0' },
  finished: { label: 'Completada', color: '#1F3864', bg: '#E8EEF7' },
  collapsed:{ label: '¡COLAPSADA!', color: '#C62828', bg: '#FFEBEE' },
  idle:     { label: 'Inactiva', color: '#6B7280', bg: '#F2F2F2' },
}

const MIN_PANEL_WIDTH = 240
const MAX_PANEL_WIDTH = 500
const DEFAULT_PANEL_WIDTH = 340

export default function ClpSimulationRunningPage() {
  const navigate = useNavigate()
  const {
    simulationState, airports, flights, kpis,
    planningProgress, firstBatchReady, animClockRef,
    pauseSimulation, resumeSimulation, cancelSimulation,
  } = useClpSimulationContext()

  const { status, simulatedTime, elapsedSeconds, config, currentDay } = simulationState

  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [collapsed, setCollapsed] = useState(true)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const startDrag = useCallback((e) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const delta = dragStartX.current - e.clientX
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartWidth.current + delta)))
    }
    const onUp = () => { isDragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  // Navigate to summary on collapse or finish
  useEffect(() => {
    if (status === 'collapsed' || status === 'finished') {
      const timer = setTimeout(() => navigate('/clp/summary'), 2500)
      return () => clearTimeout(timer)
    }
  }, [status, navigate])

  // Guard: redirect to home if idle after mount
  const statusAtMountRef = useRef(status)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (statusAtMountRef.current === 'idle') navigate('/')
    }, 2500)
    return () => clearTimeout(timer)
  }, [navigate])
  useEffect(() => { statusAtMountRef.current = status }, [status])

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle

  // Find the airport with highest occupancy for the sidebar
  const topAirport = airports.reduce((acc, a) => {
    const pct = a.occupancy || 0
    return pct > (acc?.occupancy || 0) ? a : acc
  }, null)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2', overflow: 'hidden' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: '#78350F', zIndex: 10, flexShrink: 0 }}>
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <WarningIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', fontSize: '1rem' }}>
            Tasf<span style={{ color: '#FDE68A' }}>.B2B</span>
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#92400E', my: 0.5 }} />
          <Chip label={statusInfo.label} size="small"
            sx={{ backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: 700, fontSize: '0.65rem', height: 22 }} />
          <Chip label={`Día ${currentDay}`} size="small"
            sx={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '0.65rem', height: 22 }} />

          <Box sx={{ px: 1.5 }}>
            <Typography sx={{ color: '#FDE68A', fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
              Simulación
            </Typography>
            <Typography sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1.35 }}>
              {fmtSimDate(simulatedTime)} · {fmtSimTime(simulatedTime)}
            </Typography>
            <Typography sx={{ color: 'rgba(253,232,138,0.5)', fontFamily: 'monospace', fontSize: '0.62rem', lineHeight: 1.35 }}>
              real: {formatElapsed(elapsedSeconds || 0)}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          {topAirport && (
            <Chip label={`🔺 ${topAirport.iata || topAirport.iataCode}: ${(topAirport.occupancy || 0).toFixed(0)}%`}
              size="small"
              sx={{ backgroundColor: (topAirport.occupancy || 0) >= 90 ? '#FFEBEE' : '#FFF3E0',
                color: (topAirport.occupancy || 0) >= 90 ? '#C62828' : '#E65100',
                fontWeight: 700, fontSize: '0.65rem', height: 22 }} />
          )}

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#92400E', my: 0.5 }} />

          {/* Controls */}
          {status === 'running' && (
            <Tooltip title="Pausar">
              <IconButton size="small" onClick={pauseSimulation} sx={{ color: '#FDE68A' }}>
                <PauseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {status === 'paused' && (
            <Tooltip title="Reanudar">
              <IconButton size="small" onClick={resumeSimulation} sx={{ color: '#FDE68A' }}>
                <PlayArrowIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {(status === 'running' || status === 'paused') && (
            <Tooltip title="Detener">
              <IconButton size="small" onClick={cancelSimulation} sx={{ color: '#FFCDD2' }}>
                <StopIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WorldMap airports={airports} flights={flights} simulatedTime={simulatedTime} resizeTrigger={collapsed ? 'collapsed' : panelWidth} standalone animClockRef={animClockRef} />

          <Tooltip title={collapsed ? 'Expandir KPIs' : 'Colapsar panel'} placement="left">
            <IconButton size="small" onClick={() => setCollapsed(v => !v)}
              sx={{
                position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                zIndex: 2000, width: 20, height: 48, borderRadius: '4px 0 0 4px',
                backgroundColor: '#78350F', color: '#FDE68A', boxShadow: '-2px 0 6px rgba(0,0,0,0.25)',
                '&:hover': { backgroundColor: '#92400E', color: '#FFFFFF' },
              }}>
              {collapsed ? <ChevronLeftIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>

          {/* Planning overlay */}
          {(status === 'planning' || (status === 'running' && !firstBatchReady)) && (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 3000, backgroundColor: 'rgba(120,53,15,0.72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ backgroundColor: '#78350F', borderRadius: 2, p: 4, maxWidth: 420, width: '90%',
                textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <CircularProgress size={48} sx={{ color: '#FDE68A', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
                  Calculando rutas iniciales
                </Typography>
                <Typography variant="body2" sx={{ color: '#FDE68A', mb: 2.5, fontSize: '0.82rem' }}>
                  Optimizando rutas para el escenario de colapso. La simulación iniciará automáticamente.
                </Typography>
                {planningProgress?.totalBatches > 0 && (
                  <Box>
                    <LinearProgress variant="determinate"
                      value={planningProgress.maxIterations > 0 ? (planningProgress.iteration / planningProgress.maxIterations) * 100 : 0}
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#FDE68A' } }} />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', mt: 0.5, display: 'block' }}>
                      Iteración {planningProgress.iteration} de {planningProgress.maxIterations}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Collapse detected banner */}
          {status === 'collapsed' && (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 3000, backgroundColor: 'rgba(198,40,40,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <WarningIcon sx={{ fontSize: 72, color: '#FFFFFF', mb: 2 }} />
                <Typography variant="h4" sx={{ color: '#FFFFFF', fontWeight: 900, mb: 1 }}>
                  ¡COLAPSO DETECTADO!
                </Typography>
                <Typography variant="h6" sx={{ color: '#FFCDD2', mb: 2 }}>
                  Un almacén ha superado el 100% de su capacidad
                </Typography>
                <Typography variant="body2" sx={{ color: '#FFCDD2', fontSize: '0.85rem' }}>
                  Día {currentDay} — Redirigiendo al resumen...
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Sidebar: simple KPI panel */}
        {!collapsed && (
          <>
            <Box onMouseDown={startDrag}
              sx={{ width: 5, flexShrink: 0, cursor: 'col-resize', backgroundColor: '#BFBFBF',
                '&:hover': { backgroundColor: '#92400E' } }} />
            <Box sx={{ width: panelWidth, flexShrink: 0, overflow: 'auto', borderLeft: '1px solid #BFBFBF',
              backgroundColor: '#FFFFFF', p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#78350F', mb: 2 }}>
                KPIs en Tiempo Real
              </Typography>
              {[
                { label: 'Entregas a Tiempo', value: `${(kpis.onTimeDeliveryPct || 0).toFixed(1)}%` },
                { label: 'Ocupación Vuelos', value: `${(kpis.avgFlightOccupancy || 0).toFixed(1)}%` },
                { label: 'Ocupación Almacenes', value: `${(kpis.avgWarehouseOccupancy || 0).toFixed(1)}%` },
                { label: 'Total Maletas', value: kpis.totalBags || 0 },
                { label: 'Entregadas', value: kpis.deliveredBags || 0 },
                { label: 'En Tránsito', value: kpis.inTransitBags || 0 },
                { label: 'En Espera', value: kpis.waitingBags || 0 },
                { label: 'Retrasadas', value: kpis.totalDelayedBags || 0 },
              ].map((item, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #F2F2F2' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{item.label}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1F3864' }}>{item.value}</Typography>
                </Box>
              ))}

              {/* Top 5 airports by occupancy */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#78350F', mt: 3, mb: 1 }}>
                Top Aeropuertos por Ocupación
              </Typography>
              {[...airports]
                .sort((a, b) => (b.occupancy || 0) - (a.occupancy || 0))
                .slice(0, 5)
                .map((a, i) => {
                  const pct = a.occupancy || 0
                  const color = pct >= 100 ? '#C62828' : pct >= 90 ? '#E65100' : pct >= 70 ? '#FB8C00' : '#2E7D32'
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, width: 40 }}>
                        {a.iata || a.iataCode}
                      </Typography>
                      <Box sx={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F2F2F2', overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color, width: 40, textAlign: 'right' }}>
                        {pct.toFixed(0)}%
                      </Typography>
                    </Box>
                  )
                })}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}