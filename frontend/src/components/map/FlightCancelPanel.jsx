import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import AirplanemodeInactiveIcon from '@mui/icons-material/AirplanemodeInactive'
import BlockIcon from '@mui/icons-material/Block'
import CloseIcon from '@mui/icons-material/Close'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useSimulationContext } from '../../context/SimulationContext'
import { formatFlightTime } from '../../utils/timeUtils'

const SNAPSHOT_INTERVAL = 6000
const PAGE_SIZE = 30

/* ── Sortable column header ── */
function SortableTh({ label, sortKey, activeKey, dir, onSort, style }) {
  const active = sortKey === activeKey
  return (
    <th
      style={{ ...thStyle, ...style, cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={sortKey ? () => onSort(sortKey) : undefined}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {label}
        {sortKey && active && (
          dir === 'asc'
            ? <ArrowUpwardIcon sx={{ fontSize: 11 }} />
            : <ArrowDownwardIcon sx={{ fontSize: 11 }} />
        )}
      </Box>
    </th>
  )
}

/* ── Memoized table row — avoids re-render when parent list stays the same ── */
const FlightRow = memo(function FlightRow({ f, nextDay, onCancel }) {
  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{f.id}</td>
      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{f.origin} → {f.destination}</td>
      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{formatFlightTime(f.departureUTC)}</td>
      <td style={{ fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{f.bagsAboard}/{f.capacity}</td>
      <td style={{ textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>
        <button
          onClick={() => onCancel(f)}
          style={{
            fontSize: '0.62rem', padding: '2px 8px',
            border: '1px solid #C62828', color: '#C62828',
            backgroundColor: 'transparent', borderRadius: 4,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {nextDay ? '✕ Sig. día' : '✕ Cancelar'}
        </button>
      </td>
    </tr>
  )
})

const CancelledRow = memo(function CancelledRow({ f }) {
  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{f.id}</td>
      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{f.origin} → {f.destination}</td>
      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>{formatFlightTime(f.departureUTC)}</td>
      <td style={{ padding: '5px 8px', borderBottom: '1px solid #F0F0F0' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#C62828', backgroundColor: '#FFEBEE', border: '1px solid #C62828', borderRadius: 10, padding: '1px 8px' }}>
          Cancelado
        </span>
      </td>
    </tr>
  )
})

/**
 * FlightCancelToggleButton — small floating icon button (part of the map's
 * left icon stack) that opens/closes the docked FlightCancelPanel sidebar.
 */
export function FlightCancelToggleButton({ open, onToggle }) {
  const { flights } = useSimulationContext()

  // ── Lightweight badge counter (updates every 6s, no table rebuild) ─────
  const [badgeCount, setBadgeCount] = useState(0)
  const flightsRef = useRef(flights)
  flightsRef.current = flights

  useEffect(() => {
    const count = () => {
      const c = flightsRef.current.filter(f => f.status === 'CANCELLED').length
      setBadgeCount(c)
    }
    count()
    const id = setInterval(count, SNAPSHOT_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <Box sx={{ position: 'absolute', top: 152, left: 11, zIndex: 1000 }}>
      <Tooltip title="Cancelar vuelos" placement="right">
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
              onClick={onToggle}
              sx={{ color: open ? '#fff' : '#333', p: '6px' }}
            >
              <AirplanemodeInactiveIcon fontSize="small" />
            </IconButton>
          </Paper>
          {badgeCount > 0 && (
            <Box sx={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 16, height: 16, borderRadius: '50%',
              backgroundColor: '#C62828', color: '#fff',
              fontSize: '0.55rem', fontWeight: 700, px: '3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', border: '1.5px solid #fff',
            }}>
              {badgeCount}
            </Box>
          )}
        </Box>
      </Tooltip>
    </Box>
  )
}

/**
 * FlightCancelPanel — docked sidebar panel (left of the map) listing flights
 * that can be cancelled during the simulation. Sortable, searchable, paginated.
 *
 * Performance strategy:
 * - Snapshots flights every 6s via ref (not on every tick)
 * - Memoized rows with native <tr> (no MUI overhead per row)
 * - Paginated at 30 rows to cap DOM nodes
 */
export default function FlightCancelPanel({ open, onClose }) {
  const {
    simulationState,
    flights,
    cancelFlightDuringSimulation,
  } = useSimulationContext()

  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('asc')
  const [confirmFlight, setConfirmFlight] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const flightsRef = useRef(flights)
  flightsRef.current = flights

  // ── Snapshot for table data (only when panel is open) ──────────────────
  const [snapshot, setSnapshot] = useState([])

  useEffect(() => {
    if (!open) {
      setSnapshot([])
      return
    }
    // Immediate snapshot on open
    setSnapshot(flightsRef.current)

    const id = setInterval(() => {
      setSnapshot(flightsRef.current)
    }, SNAPSHOT_INTERVAL)

    return () => clearInterval(id)
  }, [open])

  // Close panel when simulation ends
  useEffect(() => {
    if (simulationState.status === 'finished' || simulationState.status === 'idle') {
      onClose?.()
    }
  }, [simulationState.status, onClose])

  // Reset page when search, tab or sort changes
  useEffect(() => { setPage(0) }, [search, tab, sortKey, sortDir])

  const scheduledFlights = useMemo(() =>
    snapshot.filter(f => f.status === 'SCHEDULED'),
    [snapshot]
  )

  const cancelledFlights = useMemo(() =>
    snapshot.filter(f => f.status === 'CANCELLED'),
    [snapshot]
  )

  // Filter by search
  const filteredScheduled = useMemo(() => {
    if (!search) return scheduledFlights
    const q = search.toLowerCase()
    return scheduledFlights.filter(f =>
      String(f.id).includes(q) ||
      (f.origin || '').toLowerCase().includes(q) ||
      (f.destination || '').toLowerCase().includes(q) ||
      (f.airline || '').toLowerCase().includes(q)
    )
  }, [scheduledFlights, search])

  const filteredCancelled = useMemo(() => {
    if (!search) return cancelledFlights
    const q = search.toLowerCase()
    return cancelledFlights.filter(f =>
      String(f.id).includes(q) ||
      (f.origin || '').toLowerCase().includes(q) ||
      (f.destination || '').toLowerCase().includes(q)
    )
  }, [cancelledFlights, search])

  // Sorted + paginated data
  const activeList = tab === 0 ? filteredScheduled : filteredCancelled

  const sortValue = useCallback((f, key) => {
    switch (key) {
      case 'id': return f.id
      case 'route': return `${f.origin || ''}${f.destination || ''}`
      case 'departure': return f.departureUTC ? new Date(f.departureUTC).getTime() : 0
      case 'cargo': return f.capacity ? f.bagsAboard / f.capacity : f.bagsAboard || 0
      case 'status': return f.status || ''
      default: return f.id
    }
  }, [])

  const sortedList = useMemo(() => {
    const list = [...activeList]
    list.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [activeList, sortKey, sortDir, sortValue])

  const handleSort = useCallback((key) => {
    setSortKey(prevKey => {
      if (prevKey === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return prevKey
      }
      setSortDir('asc')
      return key
    })
  }, [])

  const totalPages = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageData = useMemo(() =>
    sortedList.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [sortedList, safePage]
  )

  const handleConfirmCancel = useCallback(async () => {
    if (!confirmFlight) return
    setCancelling(true)
    setCancelError(null)
    try {
      const result = await cancelFlightDuringSimulation(confirmFlight.id)
      const cancelledId = String(result?.cancelledFlightId ?? confirmFlight.id)
      // Update snapshot immediately
      setSnapshot(prev => prev.map(f =>
        String(f.id) === cancelledId || String(f.backendId) === cancelledId
          ? { ...f, status: 'CANCELLED', bagsAboard: 0 }
          : f
      ))
      setConfirmFlight(null)
      setTab(1)
    } catch (e) {
      console.error('Error cancelando vuelo:', e)
      // Keep the dialog open and tell the user why the backend refused
      setCancelError(e?.userMessage || e?.response?.data?.message
        || 'No se pudo cancelar el vuelo. Intenta de nuevo.')
    } finally {
      setCancelling(false)
    }
  }, [confirmFlight, cancelFlightDuringSimulation])

  const simNow = simulationState?.simulatedTime ? new Date(simulationState.simulatedTime) : null

  const getNextDayRule = useCallback((flight) => {
    if (!simNow || !flight.departureUTC) return false
    const dep = new Date(flight.departureUTC)
    return (dep - simNow) / 60000 < 60
  }, [simNow])

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fff',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F3864' }}>
          Cancelación de vuelos
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 32,
          '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.7rem', textTransform: 'none' },
          '& .MuiTabs-indicator': { backgroundColor: '#1F3864', height: 2 },
        }}
      >
        <Tab label={`Disponibles (${filteredScheduled.length})`} />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Cancelados
            {cancelledFlights.length > 0 && (
              <Chip
                label={cancelledFlights.length}
                size="small"
                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, backgroundColor: '#FFEBEE', color: '#C62828' }}
              />
            )}
          </Box>
        } />
      </Tabs>

      {/* Search */}
      <Box sx={{ px: 1.5, pt: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar por ID, origen, destino…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: '6px' } }}
        />
      </Box>

      {/* Table content — native <table> for minimal overhead */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 0.5, pb: 0.5 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
              {tab === 0 ? (
                <>
                  <SortableTh label="ID" sortKey="id" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Ruta" sortKey="route" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Salida UTC" sortKey="departure" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Carga" sortKey="cargo" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th style={thStyle}></th>
                </>
              ) : (
                <>
                  <SortableTh label="ID" sortKey="id" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Ruta" sortKey="route" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Salida UTC" sortKey="departure" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Estado" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '16px 8px', fontSize: '0.72rem', color: '#9CA3AF' }}>
                  {search ? 'Sin resultados' : tab === 0 ? 'No hay vuelos programados' : 'No hay vuelos cancelados'}
                </td>
              </tr>
            ) : tab === 0 ? (
              pageData.map(f => (
                <FlightRow
                  key={f.id}
                  f={f}
                  nextDay={getNextDayRule(f)}
                  onCancel={setConfirmFlight}
                />
              ))
            ) : (
              pageData.map(f => <CancelledRow key={f.id} f={f} />)
            )}
          </tbody>
        </table>
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 0.5, borderTop: '1px solid #E0E0E0', flexShrink: 0 }}>
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

      {/* Confirmation dialog */}
      <Dialog
        open={!!confirmFlight}
        onClose={() => { setConfirmFlight(null); setCancelError(null) }}
        maxWidth="xs"
        fullWidth
      >
        {confirmFlight && (() => {
          const nextDay = getNextDayRule(confirmFlight)
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700, color: '#1F3864', fontSize: '0.95rem' }}>
                ¿Cancelar vuelo {confirmFlight.id}?
              </DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ fontSize: '0.82rem' }}>
                  Ruta: <strong>{confirmFlight.origin} → {confirmFlight.destination}</strong><br />
                  Salida: <strong>{formatFlightTime(confirmFlight.departureUTC)} UTC</strong><br />
                  Carga actual: <strong>{confirmFlight.bagsAboard} / {confirmFlight.capacity} maletas</strong>
                </DialogContentText>
                <DialogContentText sx={{ fontSize: '0.78rem', mt: 1 }}>
                  Los lotes asignados a este vuelo quedarán disponibles para replanificación automática por el ALNS.
                </DialogContentText>
                {nextDay && (
                  <DialogContentText sx={{ fontSize: '0.78rem', mt: 1, color: '#E65100' }}>
                    ⚠ Faltan menos de 60 min para la salida. Se cancelará la <strong>siguiente instancia</strong> de este vuelo.
                  </DialogContentText>
                )}
                {cancelError && (
                  <DialogContentText sx={{ fontSize: '0.78rem', mt: 1, color: '#C62828', fontWeight: 600 }}>
                    ✕ {cancelError}
                  </DialogContentText>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
                <Button onClick={() => { setConfirmFlight(null); setCancelError(null) }} size="small" variant="outlined" disabled={cancelling}>
                  Mantener
                </Button>
                <Button
                  onClick={handleConfirmCancel}
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={cancelling}
                  startIcon={cancelling ? <CircularProgress size={14} color="inherit" /> : <BlockIcon />}
                >
                  {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                </Button>
              </DialogActions>
            </>
          )
        })()}
      </Dialog>
    </Box>
  )
}

const thStyle = {
  fontSize: '0.62rem',
  fontWeight: 700,
  color: '#1F3864',
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid #E0E0E0',
}
