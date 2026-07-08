import { useEffect, useRef, useState, useCallback } from 'react'
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
import Badge from '@mui/material/Badge'
import Popover from '@mui/material/Popover'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Alert from '@mui/material/Alert'
import LuggageIcon from '@mui/icons-material/Luggage'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import NotificationsIcon from '@mui/icons-material/Notifications'
import WorldMap from '../components/map/WorldMap'
import SimulationPanel from '../components/simulation/SimulationPanel'
import SimulationControls from '../components/simulation/SimulationControls'
import NotificationStack from '../components/common/NotificationStack'
import { useSimulationContext } from '../context/SimulationContext'
import { formatElapsed } from '../utils/timeUtils'

function fmtRealDate(d) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}
function fmtRealTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
function fmtSimDate(d) {
  if (!d) return '-- --- ----'
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
function fmtSimTime(d) {
  if (!d) return '--:--:-- UTC'
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} UTC`
}
function fmtSimElapsed(simTime, startDate) {
  if (!simTime || !startDate) return '--:--:--'
  const ms = simTime.getTime() - new Date(startDate).getTime()
  if (ms < 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600) % 24
  const dv = Math.floor(totalSec / 86400)
  if (dv > 0) return `${dv}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}


const STATUS_LABELS = {
  planning: { label: 'Planificando bloque...', color: '#1565C0', bg: '#E3F2FD' },
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
    planningProgress,
    firstBatchReady,
    notifications,
    bellUnreadCount,
    markBellRead,
  } = useSimulationContext()

  const { status, simulatedTime, elapsedSeconds, config } = simulationState

  const [bellAnchor, setBellAnchor] = useState(null)

  const handleBellOpen = (e) => {
    setBellAnchor(e.currentTarget)
    markBellRead()
  }
  const handleBellClose = () => setBellAnchor(null)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Sidebar resize / collapse state
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

  // ── Cross-PC / F5 guard ──────────────────────────────────────────────────
  // El hook ya intenta reconectarse al montar (reconnect en useEffect).
  // Este efecto actúa como safety-net: si después de un breve margen el
  // estado sigue en 'idle' significa que no había nada activo en el backend
  // y el usuario llegó aquí directamente — lo mandamos al inicio.
  const statusAtMountRef = useRef(status)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Leer el status actual via ref para no re-ejecutar el efecto en cada cambio
      if (statusAtMountRef.current === 'idle') {
        navigate('/')
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [navigate])

  // Mantener el ref actualizado
  useEffect(() => {
    statusAtMountRef.current = status
  }, [status])

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
            label={status === 'planning' && planningProgress?.phase
              ? planningProgress.phase
              : statusInfo.label}
            size="small"
            sx={{ backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: 700, fontSize: '0.65rem', height: 22 }}
          />

          {/* Clock block */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.25, mr: 0.5 }} />

            {/* Tiempo Real */}
            <Box sx={{ px: 1.5 }}>
              <Typography sx={{ color: '#64B5F6', fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
                Tiempo Real
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '100px auto', rowGap: 0, columnGap: '3px' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', fontSize: '0.62rem', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {fmtRealDate(now)}
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {fmtRealTime(now)}
                </Typography>
                <Typography sx={{ color: 'rgba(144,202,249,0.5)', fontFamily: 'monospace', fontSize: '0.62rem', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  transcurrido
                </Typography>
                <Typography sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {formatElapsed(elapsedSeconds || 0)}
                </Typography>
              </Box>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.25 }} />

            {/* Tiempo Simulación */}
            <Box sx={{ px: 1.5 }}>
              <Typography sx={{ color: '#A5D6A7', fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
                Simulación
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '100px auto', rowGap: 0, columnGap: '3px' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', fontSize: '0.62rem', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {fmtSimDate(simulatedTime)}
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {fmtSimTime(simulatedTime)}
                </Typography>
                <Typography sx={{ color: 'rgba(165,214,167,0.5)', fontFamily: 'monospace', fontSize: '0.62rem', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  transcurrido
                </Typography>
                <Typography sx={{ color: '#A5D6A7', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {fmtSimElapsed(simulatedTime, config?.startDate)}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          {/* Bell */}
          <Tooltip title="Historial de notificaciones">
            <IconButton size="small" onClick={handleBellOpen} sx={{ color: '#90CAF9' }}>
              <Badge badgeContent={bellUnreadCount} color="error" max={99}>
                <NotificationsIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', my: 0.5 }} />

          <SimulationControls />
        </Toolbar>
      </AppBar>

      {/* Notification history popover */}
      <Popover
        open={Boolean(bellAnchor)}
        anchorEl={bellAnchor}
        onClose={handleBellClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 420, display: 'flex', flexDirection: 'column' } }}
      >
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #BFBFBF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F3864' }}>
            Notificaciones
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}>
            {notifications.length === 0 ? 'Sin notificaciones' : `${notifications.length} total`}
          </Typography>
        </Box>
        <List dense disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 && (
            <ListItem sx={{ py: 2, justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Sin notificaciones aún</Typography>
            </ListItem>
          )}
          {[...notifications].reverse().map(n => (
            <ListItem key={n.id} disablePadding sx={{ px: 1, py: 0.4 }}>
              <Alert
                severity={n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'}
                sx={{ width: '100%', fontSize: '0.75rem', py: 0.25, opacity: n.dismissed ? 0.55 : 1 }}
                icon={false}
              >
                {n.message}
              </Alert>
            </ListItem>
          ))}
        </List>
      </Popover>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map — fills remaining space */}
        <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WorldMap airports={airports} flights={flights} simulatedTime={simulatedTime} resizeTrigger={collapsed ? 'collapsed' : panelWidth} />

          {/* Collapse / expand button — always overlaid on map right edge */}
          <Tooltip title={collapsed ? 'Expandir panel' : 'Colapsar panel'} placement="left">
            <IconButton
              size="small"
              onClick={() => setCollapsed(v => !v)}
              sx={{
                position: 'absolute',
                top: '50%',
                right: 0,
                transform: 'translateY(-50%)',
                zIndex: 2000,
                width: 20,
                height: 48,
                borderRadius: '4px 0 0 4px',
                backgroundColor: '#1F3864',
                color: '#90CAF9',
                boxShadow: '-2px 0 6px rgba(0,0,0,0.25)',
                '&:hover': { backgroundColor: '#2E75B6', color: '#FFFFFF' },
              }}
            >
              {collapsed ? <ChevronLeftIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>

          {/* Planning overlay — shown while ALNS is computing routes and until first tick is visualized */}
          {(status === 'planning' || (status === 'running' && !firstBatchReady)) && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 10,
              backgroundColor: 'rgba(15, 30, 60, 0.72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Box sx={{
                backgroundColor: '#1F3864', borderRadius: 2, p: 4,
                maxWidth: 420, width: '90%', textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                <CircularProgress size={48} sx={{ color: '#90CAF9', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
                  Calculando rutas iniciales
                </Typography>
                <Typography variant="body2" sx={{ color: '#90CAF9', mb: 2.5, fontSize: '0.82rem' }}>
                  El optimizador ALNS está asignando rutas a los envíos.
                  La simulación comenzará automáticamente al terminar.
                </Typography>

                {planningProgress?.totalBatches > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#90CAF9', fontSize: '0.72rem' }}>
                        {planningProgress.phase || 'Optimizando…'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#90CAF9', fontSize: '0.72rem' }}>
                        {planningProgress.assignedBatches} / {planningProgress.totalBatches} lotes
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={planningProgress.maxIterations > 0
                        ? (planningProgress.iteration / planningProgress.maxIterations) * 100
                        : 0}
                      sx={{
                        height: 6, borderRadius: 3,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#90CAF9' },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', mt: 0.5, display: 'block' }}>
                      Iteración {planningProgress.iteration} de {planningProgress.maxIterations}
                    </Typography>
                  </Box>
                )}

                {(!planningProgress?.totalBatches) && (
                  <LinearProgress sx={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    '& .MuiLinearProgress-bar': { backgroundColor: '#90CAF9' },
                  }} />
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Drag handle (only when not collapsed) */}
        {!collapsed && (
          <Box
            onMouseDown={startDrag}
            sx={{
              position: 'relative',
              width: 5,
              flexShrink: 0,
              cursor: 'col-resize',
              backgroundColor: '#BFBFBF',
              transition: 'background-color 0.15s',
              '&:hover': { backgroundColor: '#2E75B6' },
            }}
          />
        )}

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

      <NotificationStack />
    </Box>
  )
}