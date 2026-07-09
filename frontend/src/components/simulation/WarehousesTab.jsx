import React, { useState, useMemo, useEffect, useRef, memo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import DataTable from '../common/DataTable'
import SemaphoreChip from '../common/SemaphoreChip'
import { useSimulationContext } from '../../context/SimulationContext'
import { formatFlightTime } from '../../utils/timeUtils'
import { airportApi } from '../../api/simulationApi'

/* ── Accordion for a flight + its batches (pure, no context) ─────────── */
const FlightAccordion = memo(function FlightAccordion({ flight }) {
  const [open, setOpen] = useState(false)
  const batches = flight.batches || []

  return (
    <Box sx={{ mb: 0.5, border: '1px solid #E0E0E0', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.5, cursor: 'pointer',
          backgroundColor: '#FAFAFA', '&:hover': { backgroundColor: '#F0F0F0' },
        }}
      >
        {open ? <ExpandLessIcon sx={{ fontSize: 14, color: '#6B7280' }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: '#6B7280' }} />}
        <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600, flex: 1 }}>
          UT {flight.flightId}: {flight.origin} → {flight.destination}
        </Typography>
        <Chip
          label={flight.status === 'IN_FLIGHT' ? 'En vuelo' : 'Prog.'}
          size="small"
          sx={{
            height: 18, fontSize: '0.58rem', fontWeight: 600,
            backgroundColor: flight.status === 'IN_FLIGHT' ? '#FFF3E0' : '#F2F2F2',
            color: flight.status === 'IN_FLIGHT' ? '#E65100' : '#6B7280',
          }}
        />
        <Typography sx={{ fontSize: '0.65rem', color: '#6B7280', ml: 0.5 }}>
          {flight.totalBatchBags} mal.
        </Typography>
      </Box>
      {open && (
        <Box sx={{ px: 1, py: 0.5, backgroundColor: '#fff' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
              {flight.departureTime ? `Salida: ${formatFlightTime(flight.departureTime)}` : ''}
              {flight.arrivalTime ? ` | Llegada: ${formatFlightTime(flight.arrivalTime)}` : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>
              Carga: {flight.currentLoad}/{flight.capacity}
            </Typography>
          </Box>
          {batches.length === 0 ? (
            <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', py: 0.5 }}>Sin maletas asignadas</Typography>
          ) : (
            batches.map((b, i) => (
              <Box key={`${b.batchId}-${i}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.3, borderBottom: i < batches.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                  #{b.batchId} · {b.origin}→{b.destination}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#1F3864' }}>
                  {b.quantity} mal.
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  )
})

/* ── Detail panel — fully memoized, receives only stable props ───────── */
const WarehouseDetail = memo(function WarehouseDetail({ warehouse, whDetail, whLoading, onBack }) {
  const [detailTab, setDetailTab] = useState(0)

  // Reset tab when warehouse changes
  useEffect(() => { setDetailTab(0) }, [warehouse?.id])

  if (!warehouse) return null

  const stock = whDetail?.stock || []
  const incoming = whDetail?.incoming || []
  const outgoing = whDetail?.outgoing || []

  const stockInOrigin = stock.filter(b => b.warehouseStatus === 'EN_ORIGEN')
  const stockInTransit = stock.filter(b => b.warehouseStatus === 'EN_TRANSITO')
  const stockDelivered = stock.filter(b => b.warehouseStatus === 'ENTREGADO')

  const totalStockBags = stock.reduce((s, b) => s + b.quantity, 0)
  const totalIncomingBags = incoming.reduce((s, f) => s + f.totalBatchBags, 0)
  const totalOutgoingBags = outgoing.reduce((s, f) => s + f.totalBatchBags, 0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={onBack}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1F3864' }}>
            Almacén: {warehouse.id}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onBack}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Divider />

      {/* Summary */}
      <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Ubicación:</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{warehouse.city}, {warehouse.country}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">Ocupación:</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {warehouse.currentOccupancy || 0} / {warehouse.warehouseCapacity || 500}
            </Typography>
            <SemaphoreChip occupancyPct={warehouse.occupancy || 0} />
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Tabs */}
      <Tabs
        value={detailTab}
        onChange={(_, v) => setDetailTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 34, '& .MuiTab-root': { py: 0.5, minHeight: 34, fontSize: '0.68rem', textTransform: 'none' } }}
      >
        <Tab label={`Stock (${totalStockBags})`} />
        <Tab label={`Entran (${totalIncomingBags})`} />
        <Tab label={`Salen (${totalOutgoingBags})`} />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, mt: 0.5 }}>
        {whLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : detailTab === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <StockSection label="En origen — por salir" items={stockInOrigin} color="#1565C0" chipColor="default" />
            <Divider />
            <StockSection label="En tránsito — hub" items={stockInTransit} color="#E65100" chipColor="warning" />
            <Divider />
            <StockSection label="Destino final — entregado" items={stockDelivered} color="#2E7D32" chipColor="success" />
          </Box>
        ) : detailTab === 1 ? (
          <Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mb: 1 }}>
              Vuelos que llegan con maletas ({incoming.length} vuelos, {totalIncomingBags} mal.)
            </Typography>
            {incoming.length === 0 ? (
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', textAlign: 'center', py: 2 }}>Sin vuelos entrantes</Typography>
            ) : (
              incoming.map(f => <FlightAccordion key={f.flightId} flight={f} />)
            )}
          </Box>
        ) : (
          <Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mb: 1 }}>
              Vuelos que salen con maletas ({outgoing.length} vuelos, {totalOutgoingBags} mal.)
            </Typography>
            {outgoing.length === 0 ? (
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', textAlign: 'center', py: 2 }}>Sin vuelos salientes</Typography>
            ) : (
              outgoing.map(f => <FlightAccordion key={f.flightId} flight={f} />)
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
})

/* ── Stock sub-section (reused 3× in Stock tab) ─────────────────────── */
const StockSection = memo(function StockSection({ label, items, color, chipColor }) {
  const totalBags = items.reduce((s, b) => s + b.quantity, 0)
  return (
    <Box>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, mb: 0.5 }}>
        {label} ({items.length} envíos, {totalBags} mal.)
      </Typography>
      {items.length === 0 ? (
        <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', pl: 1 }}>Ninguno</Typography>
      ) : (
        <List dense disablePadding>
          {items.map(b => (
            <ListItem key={`${b.warehouseStatus}-${b.batchId}`} sx={{ px: 0, py: 0.2 }}>
              <ListItemText
                primary={<Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600 }}>#{b.batchId}</Typography>}
                secondary={b.warehouseStatus === 'ENTREGADO' ? `Desde ${b.origin} | ${b.airline || '—'}` : `→ ${b.destination} | ${b.airline || '—'}`}
                secondaryTypographyProps={{ sx: { fontSize: '0.65rem' } }}
              />
              <Chip label={`${b.quantity} mal.`} size="small" color={chipColor} variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
})

/* ── Main tab component (subscribes to context) ──────────────────────── */
export default function WarehousesTab() {
  const {
    airports,
    selectedAirportCode,
    setSelectedAirportCode,
    warehouseSearch,
    setWarehouseSearch,
    warehouseRegion,
    setWarehouseRegion,
    warehouseSemaphore,
    setWarehouseSemaphore,
    filteredAirports,
    airportsWithTimes,
  } = useSimulationContext()

  const [whDetail, setWhDetail] = useState(null)
  const [whLoading, setWhLoading] = useState(false)

  // Snapshot the warehouse info at selection time so the detail panel
  // doesn't re-derive it from the context on every tick.
  const [warehouseSnapshot, setWarehouseSnapshot] = useState(null)

  useEffect(() => {
    if (!selectedAirportCode) {
      setWhDetail(null)
      setWarehouseSnapshot(null)
      return
    }
    // Snapshot the warehouse data once
    const wh = airportsWithTimes.find(a => (a.iata || a.iataCode) === selectedAirportCode) || null
    setWarehouseSnapshot(wh)

    // Fetch detail from API
    let cancelled = false
    setWhLoading(true)
    airportApi.getWarehouseDetail(selectedAirportCode)
      .then(data => { if (!cancelled) setWhDetail(data) })
      .catch(() => { if (!cancelled) setWhDetail(null) })
      .finally(() => { if (!cancelled) setWhLoading(false) })
    return () => { cancelled = true }
  }, [selectedAirportCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = React.useCallback(() => setSelectedAirportCode(null), [setSelectedAirportCode])

  const regions = useMemo(() => {
    const set = new Set(airports.map(a => a.continent).filter(Boolean))
    return Array.from(set).sort()
  }, [airports])

  const warehouseCodes = useMemo(() => {
    const set = new Set(airports.map(a => a.iata || a.iataCode).filter(Boolean))
    return Array.from(set).sort()
  }, [airports])

  const columns = useMemo(() => [
    {
      field: 'id',
      headerName: 'Código',
      width: 90,
      renderCell: (params) => <b style={{ color: '#1F3864' }}>{params.value}</b>,
    },
    {
      field: 'city',
      headerName: 'Ciudad',
      width: 130,
      valueGetter: (params) => `${params.row.city}, ${params.row.country}`,
    },
    {
      field: 'currentOccupancy',
      headerName: 'Ocupación',
      width: 170,
      renderCell: (params) => {
        const capacity = params.row.warehouseCapacity || 500
        const current = params.value || 0
        const pct = params.row.occupancy || (current / capacity) * 100
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: '0.78rem', minWidth: '50px' }}>{`${current}/${capacity}`}</span>
            <SemaphoreChip occupancyPct={pct} />
          </Box>
        )
      },
    },
    {
      field: 'nextDeparture',
      headerName: 'Próx. Salida',
      width: 105,
      renderCell: (params) => params.value ? formatFlightTime(params.value) : '—',
    },
    {
      field: 'nextArrival',
      headerName: 'Próx. Llegada',
      width: 105,
      renderCell: (params) => params.value ? formatFlightTime(params.value) : '—',
    },
  ], [])

  // Detail view — rendered via memoized component with stable props
  if (warehouseSnapshot) {
    return (
      <WarehouseDetail
        warehouse={warehouseSnapshot}
        whDetail={whDetail}
        whLoading={whLoading}
        onBack={handleBack}
      />
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', p: 1 }}>
        <TextField
          size="small"
          label="Buscar almacén"
          placeholder="Ej. LIM, Lima"
          value={warehouseSearch}
          onChange={(e) => setWarehouseSearch(e.target.value)}
          sx={{ flex: 1, minWidth: '150px' }}
        />
        <TextField
          select size="small" label="Código"
          value={warehouseCodes.includes(warehouseSearch) ? warehouseSearch : 'ALL'}
          onChange={(e) => setWarehouseSearch(e.target.value === 'ALL' ? '' : e.target.value)}
          sx={{ width: '110px' }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          {warehouseCodes.map(code => <MenuItem key={code} value={code}>{code}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Región"
          value={warehouseRegion}
          onChange={(e) => setWarehouseRegion(e.target.value)}
          sx={{ width: '110px' }}
        >
          <MenuItem value="ALL">Todas</MenuItem>
          {regions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Semáforo"
          value={warehouseSemaphore}
          onChange={(e) => setWarehouseSemaphore(e.target.value)}
          sx={{ width: '120px' }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          <MenuItem value="EMPTY">Vacío (0%)</MenuItem>
          <MenuItem value="LOW">Bajo (&lt;25%)</MenuItem>
          <MenuItem value="MEDIUM">Mod. (25-50%)</MenuItem>
          <MenuItem value="HIGH">Alto (50-90%)</MenuItem>
          <MenuItem value="CRITICAL">Crítico (≥90%)</MenuItem>
        </TextField>
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          rows={filteredAirports}
          columns={columns}
          onRowClick={(params) => setSelectedAirportCode(params.row.id)}
        />
      </Box>
    </Box>
  )
}
