import { useState, useMemo, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import { formatFlightTime, formatElapsedShort } from '../../utils/timeUtils'
import client from '../../api/client'

const PAGE_SIZE = 20
const REFRESH_MS = 30000

/** Backend sends LocalDateTime.toString() (UTC, no zone suffix) — normalize to epoch ms. */
function toUtcMs(iso) {
  if (!iso) return null
  return new Date(String(iso).endsWith('Z') ? iso : iso + 'Z').getTime()
}

/** Semaphore color by remaining margin against the shipment deadline. */
function marginColors(deadlineMs, simMs) {
  if (!deadlineMs || !simMs) return { bg: '#F2F2F2', fg: '#6B7280' }
  const marginH = (deadlineMs - simMs) / 3600000
  if (marginH < 2) return { bg: '#FFEBEE', fg: '#C62828' }
  if (marginH < 6) return { bg: '#FFF3E0', fg: '#E65100' }
  return { bg: '#E8F5E9', fg: '#2E7D32' }
}

/* ── Single waiting shipment row ─────────────────────────────────────── */
function WaitingRow({ item, simMs }) {
  const arrivedMs = toUtcMs(item.arrivedAt)
  const departsMs = toUtcMs(item.nextDeparture)
  const deadlineMs = toUtcMs(item.deadline)

  const waitingSec = arrivedMs && simMs ? Math.max(0, (simMs - arrivedMs) / 1000) : null
  const remainingSec = departsMs && simMs ? Math.max(0, (departsMs - simMs) / 1000) : null
  const sem = marginColors(deadlineMs, simMs)

  return (
    <Box sx={{ mb: 0.5, px: 1, py: 0.6, border: '1px solid #E0E0E0', borderRadius: 1, backgroundColor: '#FAFAFA' }}>
      {/* Line 1: batch + route + qty */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600, flex: 1 }}>
          #{item.batchId}: {item.origin} → {item.destination}
        </Typography>
        <Chip
          label={`tramo ${item.legOrder}/${item.totalLegs}`}
          size="small"
          sx={{ height: 18, fontSize: '0.58rem', fontWeight: 600, backgroundColor: '#F2F2F2', color: '#6B7280' }}
        />
        <Typography sx={{ fontSize: '0.65rem', color: '#6B7280' }}>
          {item.quantity} mal.
        </Typography>
      </Box>

      {/* Line 2: where + waiting time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
        <WarehouseIcon sx={{ fontSize: 12, color: '#6B7280' }} />
        <Typography sx={{ fontSize: '0.65rem', color: '#374151' }}>
          En escala en <b>{item.waitingAt}</b>
          {item.arrivedAt ? ` desde ${formatFlightTime(item.arrivedAt)}` : ''}
        </Typography>
        {waitingSec != null && (
          <span style={{
            fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8,
            backgroundColor: sem.bg, color: sem.fg, marginLeft: 'auto',
          }}>
            esperando {formatElapsedShort(waitingSec)}
          </span>
        )}
      </Box>

      {/* Line 3: next flight + deadline */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
        <FlightTakeoffIcon sx={{ fontSize: 12, color: '#6B7280' }} />
        <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
          Sale {item.nextDeparture ? formatFlightTime(item.nextDeparture) : '--'} (UT {item.nextFlightId})
          {remainingSec != null ? ` · en ${formatElapsedShort(remainingSec)}` : ''}
          {item.deadline ? ` · deadline ${formatFlightTime(item.deadline)}` : ''}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * WaitingShipmentsPanel — floating button + panel listing shipments waiting on the
 * ground at an intermediate stop, with live waiting time against the sim clock.
 */
export default function WaitingShipmentsPanel({ simulatedTime = null, open: openProp, onToggle }) {
  // Controlled by the parent (to keep a single panel open at a time) when
  // open/onToggle are provided; falls back to local state otherwise.
  const [localOpen, setLocalOpen] = useState(false)
  const open = onToggle ? openProp : localOpen
  const toggle = onToggle || (() => setLocalOpen(o => !o))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const simMs = simulatedTime ? new Date(simulatedTime).getTime() : null

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await client.get('/shipments/waiting')
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      console.warn('Error fetching waiting shipments:', e.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on open + periodic refresh while open (list changes on departures/arrivals)
  useEffect(() => {
    if (!open) return
    fetchItems()
    const id = setInterval(fetchItems, REFRESH_MS)
    return () => clearInterval(id)
  }, [open, fetchItems])

  useEffect(() => { setPage(0) }, [search])

  const filtered = useMemo(() => {
    let list = items
    if (search) {
      const q = search.toLowerCase()
      list = items.filter(i =>
        String(i.batchId).includes(q) ||
        String(i.shipmentId).includes(q) ||
        (i.origin || '').toLowerCase().includes(q) ||
        (i.destination || '').toLowerCase().includes(q) ||
        (i.waitingAt || '').toLowerCase().includes(q) ||
        (i.airline || '').toLowerCase().includes(q)
      )
    }
    // Longest wait first
    return [...list].sort((a, b) => (toUtcMs(a.arrivedAt) ?? Infinity) - (toUtcMs(b.arrivedAt) ?? Infinity))
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageData = useMemo(() =>
    filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filtered, safePage]
  )

  const totalBags = useMemo(() => filtered.reduce((acc, i) => acc + (i.quantity || 0), 0), [filtered])
  const airportCount = useMemo(() => new Set(filtered.map(i => i.waitingAt)).size, [filtered])

  return (
    <Box sx={{ position: 'absolute', top: 226, left: 11, zIndex: 1000 }}>
      {/* Toggle button */}
      <Tooltip title="Envíos en escala" placement="right">
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
              <HourglassBottomIcon fontSize="small" />
            </IconButton>
          </Paper>
          {items.length > 0 && !open && (
            <Box sx={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 16, height: 16, borderRadius: '50%',
              backgroundColor: '#E65100', color: '#fff',
              fontSize: '0.55rem', fontWeight: 700, px: '3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', border: '1.5px solid #fff',
            }}>
              {items.length}
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Panel */}
      {open && (
        <Paper
          elevation={4}
          sx={{
            mt: -4, p: 0, ml: 5,
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderRadius: 1.5, width: 440,
            backdropFilter: 'blur(4px)',
            maxHeight: 'calc(100vh - 280px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, pt: 1.5, pb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1F3864' }}>
              Envíos en escala
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Actualizar">
                <IconButton size="small" onClick={fetchItems} disabled={loading}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={toggle}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, pb: 0.75 }}>
            <Chip
              icon={<HourglassBottomIcon sx={{ fontSize: '12px !important' }} />}
              label={`${filtered.length} envíos`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#FFF3E0', color: '#E65100' }}
            />
            <Chip
              label={`${totalBags} maletas`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#F2F2F2', color: '#6B7280' }}
            />
            <Chip
              label={`${airportCount} aeropuerto${airportCount !== 1 ? 's' : ''}`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: '#F2F2F2', color: '#6B7280' }}
            />
          </Box>

          {/* Search */}
          <Box sx={{ px: 1.5, pb: 0.75 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por lote, escala, origen, destino…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: '6px' } }}
            />
          </Box>

          {/* List */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 0.5 }}>
            {loading && items.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : pageData.length === 0 ? (
              <Typography sx={{ textAlign: 'center', py: 2, fontSize: '0.72rem', color: '#9CA3AF' }}>
                {search ? 'Sin resultados' : 'No hay envíos esperando en escalas'}
              </Typography>
            ) : (
              pageData.map(i => (
                <WaitingRow key={`${i.shipmentId}-${i.nextFlightId}`} item={i} simMs={simMs} />
              ))
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
