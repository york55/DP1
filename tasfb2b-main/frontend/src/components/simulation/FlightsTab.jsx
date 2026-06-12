import React, { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Drawer from '@mui/material/Drawer'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import DataTable from '../common/DataTable'
import SemaphoreChip from '../common/SemaphoreChip'
import { useSimulationContext } from '../../context/SimulationContext'
import { formatFlightTime } from '../../utils/timeUtils'

const STATUS_STYLES = {
  SCHEDULED: { label: 'Programado', color: '#6B7280', bg: '#F2F2F2' },
  IN_FLIGHT: { label: 'En Vuelo', color: '#E65100', bg: '#FFF3E0' },
  LANDED: { label: 'Aterrizó', color: '#2E7D32', bg: '#E8F5E9' },
  CANCELLED: { label: 'Cancelado', color: '#C62828', bg: '#FFEBEE' },
}

function FlightStatusChip({ status }) {
  const style = STATUS_STYLES[status] || { label: status, color: '#6B7280', bg: '#F2F2F2' }
  return (
    <Chip
      label={style.label}
      size="small"
      sx={{
        backgroundColor: style.bg,
        color: style.color,
        fontWeight: 600,
        fontSize: '0.7rem',
        border: `1px solid ${style.color}`,
      }}
    />
  )
}

export default function FlightsTab() {
  const { flights, shipments } = useSimulationContext()
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('ALL')
  const [destFilter, setDestFilter] = useState('ALL')
  const [selectedFlight, setSelectedFlight] = useState(null)
  const [detailTab, setDetailTab] = useState(0)

  // Get unique airports for filters
  const origins = useMemo(() => {
    const set = new Set(flights.map(f => f.origin).filter(Boolean))
    return Array.from(set).sort()
  }, [flights])

  const destinations = useMemo(() => {
    const set = new Set(flights.map(f => f.destination).filter(Boolean))
    return Array.from(set).sort()
  }, [flights])

  // Filtered flights
  const filteredFlights = useMemo(() => {
    return flights.filter(f => {
      const matchesSearch = f.id.toLowerCase().includes(search.toLowerCase()) ||
        `${f.origin}-${f.destination}`.toLowerCase().includes(search.toLowerCase())
      const matchesOrigin = originFilter === 'ALL' || f.origin === originFilter
      const matchesDest = destFilter === 'ALL' || f.destination === destFilter
      return matchesSearch && matchesOrigin && matchesDest
    })
  }, [flights, search, originFilter, destFilter])

  // Shipments aboard the selected flight
  const flightShipments = useMemo(() => {
    if (!selectedFlight) return []
    return shipments.filter(s => String(s.currentFlight) === String(selectedFlight.id))
  }, [selectedFlight, shipments])

  // Bags lots aboard the selected flight
  const flightBags = useMemo(() => {
    if (!selectedFlight) return []
    const lots = []
    flightShipments.forEach((shipment, shipIdx) => {
      const lotCount = shipment.totalBags > 40 ? 3 : shipment.totalBags > 20 ? 2 : 1
      const bagsPerLot = Math.floor(shipment.totalBags / lotCount)
      const remainder = shipment.totalBags % lotCount

      for (let i = 0; i < lotCount; i++) {
        const isLast = i === lotCount - 1
        const bagCount = isLast ? bagsPerLot + remainder : bagsPerLot
        lots.push({
          id: `LOT-${String(shipIdx + 1).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`,
          shipmentId: shipment.id,
          bagCount,
          client: shipment.client,
        })
      }
    })
    return lots
  }, [flightShipments, selectedFlight])

  const columns = [
    {
      field: 'id',
      headerName: 'ID',
      width: 100,
      renderCell: (params) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>{params.value}</span>
      ),
    },
    {
      field: 'route',
      headerName: 'Ruta',
      width: 100,
      valueGetter: (params) => `${params.row.origin} → ${params.row.destination}`,
    },
    {
      field: 'bagsAboard',
      headerName: 'Ocupación',
      width: 180,
      renderCell: (params) => {
        const capacity = params.row.capacity || 1
        const pct = (params.value / capacity) * 100
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: '0.78rem', minWidth: '50px' }}>{`${params.value}/${capacity}`}</span>
            <SemaphoreChip occupancyPct={pct} />
          </Box>
        )
      },
    },
    {
      field: 'departureUTC',
      headerName: 'Salida UTC',
      width: 95,
      renderCell: (params) => formatFlightTime(params.value),
    },
    {
      field: 'arrivalUTC',
      headerName: 'Llegada UTC',
      width: 95,
      renderCell: (params) => formatFlightTime(params.value),
    },
    {
      field: 'status',
      headerName: 'Estado',
      width: 110,
      renderCell: (params) => <FlightStatusChip status={params.value} />,
    },
  ]

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Search & Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', p: 1 }}>
        <TextField
          size="small"
          label="Buscar vuelo o tramo"
          placeholder="Ej. SKBO"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: '150px' }}
        />
        <TextField
          select
          size="small"
          label="Origen"
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          sx={{ width: '100px' }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          {origins.map(code => (
            <MenuItem key={code} value={code}>{code}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Destino"
          value={destFilter}
          onChange={(e) => setDestFilter(e.target.value)}
          sx={{ width: '100px' }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          {destinations.map(code => (
            <MenuItem key={code} value={code}>{code}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Flights Table */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          rows={filteredFlights}
          columns={columns}
          onRowClick={(params) => {
            setSelectedFlight(params.row)
            setDetailTab(0)
          }}
        />
      </Box>

      {/* Flight Detail Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedFlight)}
        onClose={() => setSelectedFlight(null)}
        PaperProps={{ sx: { width: 360, p: 2 } }}
      >
        {selectedFlight && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>
                Detalle de UT: {selectedFlight.id}
              </Typography>
              <IconButton onClick={() => setSelectedFlight(null)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            {/* Info Summary */}
            <Box sx={{ my: 2, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Ruta:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedFlight.origin} → {selectedFlight.destination}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Aerolínea:</Typography>
                <Typography variant="body2">{selectedFlight.airline}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Ocupación:</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedFlight.bagsAboard} / {selectedFlight.capacity}</Typography>
                  <SemaphoreChip occupancyPct={(selectedFlight.bagsAboard / (selectedFlight.capacity || 1)) * 100} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Salida:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatFlightTime(selectedFlight.departureUTC)} UTC</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Llegada:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatFlightTime(selectedFlight.arrivalUTC)} UTC</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Estado:</Typography>
                <FlightStatusChip status={selectedFlight.status} />
              </Box>
            </Box>

            <Divider />

            {/* Tabs inside Drawer */}
            <Tabs
              value={detailTab}
              onChange={(e, v) => setDetailTab(v)}
              variant="fullWidth"
              sx={{ minHeight: 36, mt: 1, '& .MuiTab-root': { py: 1, minHeight: 36, fontSize: '0.75rem' } }}
            >
              <Tab label="Envíos" />
              <Tab label="Lotes" />
            </Tabs>

            {/* Tab Panels */}
            <Box sx={{ flex: 1, overflowY: 'auto', mt: 1 }}>
              {detailTab === 0 ? (
                <List dense>
                  {flightShipments.length === 0 ? (
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', my: 2, color: 'text.secondary' }}>
                      Sin envíos asignados a este vuelo
                    </Typography>
                  ) : (
                    flightShipments.map(s => (
                      <ListItem key={s.id} sx={{ px: 0, py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {s.id}
                            </Typography>
                          }
                          secondary={`Cliente: ${s.client} | Destino: ${s.destination}`}
                        />
                        <Chip label={`${s.totalBags} maletas`} size="small" variant="outlined" />
                      </ListItem>
                    ))
                  )}
                </List>
              ) : (
                <List dense>
                  {flightBags.length === 0 ? (
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', my: 2, color: 'text.secondary' }}>
                      Sin maletas asignadas
                    </Typography>
                  ) : (
                    flightBags.map(b => (
                      <ListItem key={b.id} sx={{ px: 0, py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {b.id}
                            </Typography>
                          }
                          secondary={`Envío: ${b.shipmentId} (${b.client})`}
                        />
                        <Chip label={`${b.bagCount} maletas`} size="small" color="primary" variant="outlined" />
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  )
}
