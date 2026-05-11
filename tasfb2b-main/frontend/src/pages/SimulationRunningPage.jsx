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
import LuggageIcon from '@mui/icons-material/Luggage'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TimerIcon from '@mui/icons-material/Timer'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import WorldMap from '../components/map/WorldMap'
import SimulationPanel from '../components/simulation/SimulationPanel'
import SimulationControls from '../components/simulation/SimulationControls'
import StatusBar from '../components/common/StatusBar'
import NotificationStack from '../components/common/NotificationStack'
import { useSimulationContext } from '../context/SimulationContext'
import { formatUTCFull, formatElapsed } from '../utils/timeUtils'

const STATUS_LABELS = {
  planning: { label: 'Planificando', color: '#1565C0', bg: '#E3F2FD' },
  running: { label: 'En Ejecución', color: '#2E7D32', bg: '#E8F5E9' },
  paused: { label: 'Pausada', color: '#E65100', bg: '#FFF3E0' },
  finished: { label: 'Completada', color: '#1F3864', bg: '#E8EEF7' },
  idle: { label: 'Inactiva', color: '#6B7280', bg: '#F2F2F2' },
}

const MIN_PANEL_WIDTH = 240
const MAX_PANEL_WIDTH = 700
const DEFAULT_PANEL_WIDTH = 380

export default function SimulationRunningPage() {
  const navigate = useNavigate()
  const {
    simulationState,
    airports,
    flights,
    shipments,
  } = useSimulationContext()

  const { status, simulatedTime, elapsedSeconds, config } = simulationState

  // Sidebar resize / collapse state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
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
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Navigate to summary when finished
  useEffect(() => {
    if (status === 'finished') {
      const timer = setTimeout(() => navigate('/simulation/summary'), 2000)
      return () => clearTimeout(timer)
    }
  }, [status, navigate])

  const delayedCount = React.useMemo(() =>
    shipments.filter(s => s.status === 'DELAYED').length,
    [shipments]
  )

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2', overflow: 'hidden' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: '#1F3864', zIndex: 10, flexShrink: 0 }}>
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <LuggageIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', fontSize: '1rem' }}>
            Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          <Chip
            label={statusInfo.label}
            size="small"
            sx={{ backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: 700, fontSize: '0.65rem', height: 22 }}
          />

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: '#90CAF9' }} />
            <Typography variant="caption" sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {simulatedTime ? formatUTCFull(simulatedTime) : '-- --- ---- --:--:-- UTC'}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimerIcon sx={{ fontSize: 14, color: '#90CAF9' }} />
            <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {formatElapsed(elapsedSeconds || 0)}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          {delayedCount > 0 && (
            <Chip
              label={`${delayedCount} retrasados`}
              size="small"
              sx={{ backgroundColor: '#FFEBEE', color: '#C62828', fontWeight: 700, fontSize: '0.65rem', height: 22 }}
            />
          )}

          <Typography variant="caption" sx={{ color: '#90CAF9', fontSize: '0.7rem' }}>
            Período: {config?.period || 0} días
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          <SimulationControls />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', mb: '32px' }}>
        {/* Map — fills remaining space */}
        <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WorldMap airports={airports} flights={flights} simulatedTime={simulatedTime} />
        </Box>

        {/* Drag handle + collapse toggle button */}
        <Box
          sx={{ position: 'relative', display: 'flex', alignItems: 'stretch', flexShrink: 0, width: collapsed ? 20 : undefined }}
        >
          {/* Drag handle (only when not collapsed) */}
          {!collapsed && (
            <Box
              onMouseDown={startDrag}
              sx={{
                width: 5,
                cursor: 'col-resize',
                backgroundColor: '#BFBFBF',
                flexShrink: 0,
                transition: 'background-color 0.15s',
                '&:hover': { backgroundColor: '#2E75B6' },
              }}
            />
          )}

          {/* Floating collapse / expand button */}
          <Tooltip title={collapsed ? 'Expandir panel' : 'Colapsar panel'} placement="left">
            <IconButton
              size="small"
              onClick={() => setCollapsed(v => !v)}
              sx={{
                position: 'absolute',
                top: '50%',
                left: collapsed ? 0 : -18,
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: 20,
                height: 48,
                borderRadius: collapsed ? '0 4px 4px 0' : '4px 0 0 4px',
                backgroundColor: '#1F3864',
                color: '#90CAF9',
                boxShadow: collapsed ? '2px 0 6px rgba(0,0,0,0.25)' : '-2px 0 6px rgba(0,0,0,0.25)',
                '&:hover': { backgroundColor: '#2E75B6', color: '#FFFFFF' },
              }}
            >
              {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right panel — hidden when collapsed */}
        {!collapsed && (
          <Box
            sx={{
              width: panelWidth,
              flexShrink: 0,
              overflow: 'hidden',
              borderLeft: '1px solid #BFBFBF',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SimulationPanel />
          </Box>
        )}
      </Box>

      <StatusBar />
      <NotificationStack />
    </Box>
  )
}
