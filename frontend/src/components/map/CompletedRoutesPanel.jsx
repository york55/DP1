import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import RouteIcon from '@mui/icons-material/Route'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { formatFlightTime } from '../../utils/timeUtils'
import client from '../../api/client'

const PAGE_SIZE = 20

/* ── Single route accordion ──────────────────────────────────────────── */
const RouteAccordion = memo(function RouteAccordion({ route }) {
  const [open, setOpen] = useState(false)
  const legs = route.legs || []
  const isDelayed = route.shipmentStatus === 'DELAYED'

  return (
    <Box sx={{ mb: 0.5, border: '1px solid #E0E0E0', borderRadius: 1, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.6, cursor: 'pointer',
          backgroundColor: isDelayed ? '#FFF8E1' : '#FAFAFA',
          '&:hover': { backgroundColor: isDelayed ? '#FFF3E0' : '#F0F0F0' },
        }}
      >
        {open
          ? <ExpandLessIcon sx={{ fontSize: 14, color: '#6B7280' }} />
          : <ExpandMoreIcon sx={{ fontSize: 14, color: '#6B7280' }} />
        }
        {isDelayed
          ? <ErrorIcon sx={{ fontSize: 14, color: '#E65100' }} />
          : <CheckCircleIcon sx={{ fontSize: 14, color: '#2E7D32' }} />
        }
        <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600, flex: 1 }}>
          #{route.batchId}: {route.origin} → {route.destination}
        </Typography>
        <Chip
          label={`${legs.length} escala${legs.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 18, fontSize: '0.58rem', fontWeight: 600, backgroundColor: '#F2F2F2', color: '#6B7280' }}
        />
        <Typography sx={{ fontSize: '0.65rem', color: '#6B7280', ml: 0.5 }}>
          {route.quantity} mal.
        </Typography>
      </Box>

      {/* Expanded detail */}
      {open && (
        <Box sx={{ px: 1, py: 0.5, backgroundColor: '#fff' }}>
          {/* Route summary */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
              Aerolínea: {route.airline || '—'}
            </Typography>
            {route.deliveredAt && (
              <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
                Entregado: {formatFlightTime(route.deliveredAt)}
              </Typography>
            )}
            {route.deadline && (
              <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
                Deadline: {formatFlightTime(route.deadline)}
              </Typography>
            )}
          </Box>

          {/* Legs timeline */}
          {legs.map((leg, i) => (
            <Box key={`${route.routeId}-leg-${leg.legOrder}`} sx={{ display: 'flex', alignItems: 'stretch', mb: 0.25 }}>
              {/* Timeline indicator */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 1, width: 16 }}>
                <Box sx={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: leg.status === 'COMPLETED' ? '#2E7D32' : leg.status === 'CANCELLED' ? '#C62828' : '#1565C0',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px ' + (leg.status === 'COMPLETED' ? '#2E7D32' : leg.status === 'CANCELLED' ? '#C62828' : '#1565C0'),
                }} />
                {i < legs.length - 1 && (
                  <Box sx={{ width: 2, flex: 1, backgroundColor: '#E0E0E0', minHeight: 16 }} />
                )}
              </Box>

              {/* Leg info */}
              <Box sx={{ flex: 1, pb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 600 }}>
                    Tramo {leg.legOrder}: {leg.flightOrigin} → {leg.flightDestination}
                  </Typography>
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 600, padding: '0 5px', borderRadius: 8,
                    backgroundColor: leg.status === 'COMPLETED' ? '#E8F5E9' : leg.status === 'CANCELLED' ? '#FFEBEE' : '#E3F2FD',
                    color: leg.status === 'COMPLETED' ? '#2E7D32' : leg.status === 'CANCELLED' ? '#C62828' : '#1565C0',
                    border: `1px solid ${leg.status === 'COMPLETED' ? '#2E7D32' : leg.status === 'CANCELLED' ? '#C62828' : '#1565C0'}`,
                  }}>
                    {leg.status === 'COMPLETED' ? 'Completado' : leg.status === 'CANCELLED' ? 'Cancelado' : leg.status}
                  </span>
                </Box>
                <Typography sx={{ fontSize: '0.6rem', color: '#9CA3AF' }}>
                  UT {leg.flightId}
                  {leg.departureTime ? ` · Salida: ${formatFlightTime(leg.departureTime)}` : ''}
                  {leg.arrivalTime ? ` · Llegada: ${formatFlightTime(leg.arrivalTime)}` : ''}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
})

/**
 * CompletedRoutesPanel — floating button + panel showing completed shipment routes
 * with their legs/stops. Fetches on-demand (not subscribed to context ticks).
 */
export default function CompletedRoutesPanel() {
  const [open, setOpen] = useState(false)
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await client.get('/routes/completed')
      setRoutes(Array.isArray(res.data) ? res.data : [])    } catch (e) {
      console.warn('Error fetching completed routes:', e.message)
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on open
  useEffect(() => {
    if (open) fetchRoutes()
  }, [open, fetchRoutes])

  useEffect(() => { setPage(0) }, [search])

  const filtered = useMemo(() => {
    if (!search) return routes
    const q = search.toLowerCase()
    return routes.filter(r =>
      String(r.batchId).includes(q) ||
      String(r.shipmentId).includes(q) ||
      (r.origin || '').toLowerCase().includes(q) ||
      (r.destination || '').toLowerCase().includes(q) ||
      (r.airline || '').toLowerCase().includes(q) ||
      (r.shipmentStatus || '').toLowerCase().includes(q)
    )
  }, [routes, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageData = useMemo(() =>
    filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filtered, safePage]
  )

  const deliveredCount = routes.filter(r => r.shipmentStatus === 'DELIVERED').length
  const delayedCount = routes.filter(r => r.shipmentStatus === 'DELAYED').length

  return (
    <Box sx={{ position: 'absolute', top: 188, left: 11, zIndex: 1000 }}>
      {/* Toggle button */}
      <Tooltip title="Rutas completadas" placement="right">
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
              onClick={() => setOpen(o => !o)}
              sx={{ color: open ? '#fff' : '#333', p: '6px' }}
            >
              <RouteIcon fontSize="small" />
            </IconButton>
          </Paper>
          {routes.length > 0 && !open && (
            <Box sx={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 16, height: 16, borderRadius: '50%',
              backgroundColor: '#1565C0', color: '#fff',
              fontSize: '0.55rem', fontWeight: 700, px: '3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', border: '1.5px solid #fff',
            }}>
              {routes.length}
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Panel */}
      {open && (
        <Paper
          elevation={4}
          sx={{
            mt: 1, p: 0,
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderRadius: 1.5, width: 440,
            backdropFilter: 'blur(4px)',
            maxHeight: 'calc(100vh - 240px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, pt: 1.5, pb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1F3864' }}>
              Rutas completadas
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Actualizar">
                <IconButton size="small" onClick={fetchRoutes} disabled={loading}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, pb: 0.75 }}>
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
              label={`${deliveredCount} entregados`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#E8F5E9', color: '#2E7D32' }}
            />
            {delayedCount > 0 && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: '12px !important' }} />}
                label={`${delayedCount} retrasados`}
                size="small"
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#FFF3E0', color: '#E65100' }}
              />
            )}
            <Chip
              label={`${filtered.length} total`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#F2F2F2', color: '#6B7280' }}
            />
          </Box>

          {/* Search */}
          <Box sx={{ px: 1.5, pb: 0.75 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por lote, envío, origen, destino…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: '6px' } }}
            />
          </Box>

          {/* Routes list */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 0.5 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : pageData.length === 0 ? (
              <Typography sx={{ textAlign: 'center', py: 2, fontSize: '0.72rem', color: '#9CA3AF' }}>
                {search ? 'Sin resultados' : 'No hay rutas completadas aún'}
              </Typography>
            ) : (
              pageData.map(r => <RouteAccordion key={r.routeId} route={r} />)
            )}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 0.5, borderTop: '1px solid #E0E0E0' }}>
              <IconButton size="small" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
                <NavigateBeforeIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <Typography sx={{ fontSize: '0.65rem', color: '#6B7280' }}>
                {safePage + 1} / {totalPages}
              </Typography>
              <IconButton size="small" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <NavigateNextIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}
