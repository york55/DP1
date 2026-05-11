import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Badge from '@mui/material/Badge'
import Chip from '@mui/material/Chip'
import NotificationsIcon from '@mui/icons-material/Notifications'
import LuggageIcon from '@mui/icons-material/Luggage'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TimerIcon from '@mui/icons-material/Timer'
import WorldMap from '../components/map/WorldMap'
import SimulationPanel from '../components/simulation/SimulationPanel'
import SimulationControls from '../components/simulation/SimulationControls'
import StatusBar from '../components/common/StatusBar'
import NotificationStack from '../components/common/NotificationStack'
import { useSimulationContext } from '../context/SimulationContext'
import { formatUTCFull, formatElapsed } from '../utils/timeUtils'

const STATUS_LABELS = {
  running: { label: 'En Ejecución', color: '#2E7D32', bg: '#E8F5E9' },
  paused: { label: 'Pausada', color: '#E65100', bg: '#FFF3E0' },
  finished: { label: 'Completada', color: '#1F3864', bg: '#E8EEF7' },
  idle: { label: 'Inactiva', color: '#6B7280', bg: '#F2F2F2' },
}

export default function SimulationRunningPage() {
  const navigate = useNavigate()
  const {
    simulationState,
    airports,
    flights,
    shipments,
    notifications,
  } = useSimulationContext()

  const { status, simulatedTime, elapsedSeconds, config } = simulationState

  // Navigate to summary when finished
  useEffect(() => {
    if (status === 'finished') {
      const timer = setTimeout(() => {
        navigate('/simulation/summary')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status, navigate])

  const delayedCount = React.useMemo(() => 
    shipments.filter(s => s.status === 'DELAYED').length,
    [shipments]
  )
  
  const activeNotifications = React.useMemo(() => 
    notifications.filter(n => !n.dismissed).length,
    [notifications]
  )
  
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#F2F2F2',
        overflow: 'hidden',
      }}
    >
      {/* AppBar */}
      <AppBar
        position="static"
        sx={{ backgroundColor: '#1F3864', zIndex: 10, flexShrink: 0 }}
      >
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <LuggageIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', fontSize: '1rem' }}>
            Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          {/* Simulation status chip */}
          <Chip
            label={statusInfo.label}
            size="small"
            sx={{
              backgroundColor: statusInfo.bg,
              color: statusInfo.color,
              fontWeight: 700,
              fontSize: '0.65rem',
              height: 22,
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          {/* Simulated time */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: '#90CAF9' }} />
            <Typography
              variant="caption"
              sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {simulatedTime ? formatUTCFull(simulatedTime) : '-- --- ---- --:--:-- UTC'}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          {/* Elapsed */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimerIcon sx={{ fontSize: 14, color: '#90CAF9' }} />
            <Typography
              variant="caption"
              sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {formatElapsed(elapsedSeconds || 0)}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Delayed badge */}
          {delayedCount > 0 && (
            <Chip
              label={`${delayedCount} retrasados`}
              size="small"
              sx={{
                backgroundColor: '#FFEBEE',
                color: '#C62828',
                fontWeight: 700,
                fontSize: '0.65rem',
                height: 22,
              }}
            />
          )}

          {/* Period info */}
          <Typography variant="caption" sx={{ color: '#90CAF9', fontSize: '0.7rem' }}>
            Período: {config?.period || 0} días
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          {/* Controls */}
          <SimulationControls />
        </Toolbar>
      </AppBar>

      {/* Main Content: 70/30 split */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', mb: '32px' }}>
        {/* Left: Map (70%) */}
        <Box sx={{ flex: '0 0 70%', position: 'relative' }}>
          <WorldMap
            airports={airports}
            flights={flights}
            simulatedTime={simulatedTime}
          />
        </Box>

        {/* Right: Simulation Panel (30%) */}
        <Box
          sx={{
            flex: '0 0 30%',
            overflow: 'hidden',
            borderLeft: '1px solid #BFBFBF',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SimulationPanel />
        </Box>
      </Box>

      {/* Status Bar (fixed bottom) */}
      <StatusBar />

      {/* Notification Stack */}
      <NotificationStack />
    </Box>
  )
}
