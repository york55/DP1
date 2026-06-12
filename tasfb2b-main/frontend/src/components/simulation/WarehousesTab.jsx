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

export default function WarehousesTab() {
  const {
    airports,
    flights,
    shipments,
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

  const [detailTab, setDetailTab] = useState(0)

  // Get unique continents/regions
  const regions = useMemo(() => {
    const set = new Set(airports.map(a => a.continent).filter(Boolean))
    return Array.from(set).sort()
  }, [airports])

  const selectedWarehouse = useMemo(() => {
    if (!selectedAirportCode) return null
    return airportsWithTimes.find(a => (a.iata || a.iataCode) === selectedAirportCode) || null
  }, [selectedAirportCode, airportsWithTimes])

  // Warehouse detailed lists
  const warehouseDetails = useMemo(() => {
    if (!selectedWarehouse) return { transitShipments: [], deliveredShipments: [], incomingFlights: [], outgoingFlights: [] }
    const code = selectedWarehouse.iata || selectedWarehouse.iataCode

    const transitShipments = shipments.filter(s => s.origin === code && s.status === 'IN_ORIGIN')
    const deliveredShipments = shipments.filter(s => s.destination === code && s.status === 'DELIVERED')

    const incomingFlights = flights.filter(f => f.destination === code && (f.status === 'IN_FLIGHT' || f.status === 'SCHEDULED'))
    const outgoingFlights = flights.filter(f => f.origin === code && (f.status === 'IN_FLIGHT' || f.status === 'SCHEDULED'))

    return { transitShipments, deliveredShipments, incomingFlights, outgoingFlights }
  }, [selectedWarehouse, shipments, flights])

  const columns = [
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
  ]

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Filters */}
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
          select
          size="small"
          label="Región"
          value={warehouseRegion}
          onChange={(e) => setWarehouseRegion(e.target.value)}
          sx={{ width: '110px' }}
        >
          <MenuItem value="ALL">Todas</MenuItem>
          {regions.map(r => (
            <MenuItem key={r} value={r}>{r}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Semáforo"
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

      {/* Warehouses Table */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          rows={filteredAirports}
          columns={columns}
          onRowClick={(params) => {
            setSelectedAirportCode(params.row.id)
            setDetailTab(0)
          }}
        />
      </Box>

      {/* Warehouse Detail Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedWarehouse)}
        onClose={() => setSelectedAirportCode(null)}
        PaperProps={{ sx: { width: 360, p: 2 } }}
      >
        {selectedWarehouse && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>
                Almacén: {selectedWarehouse.id}
              </Typography>
              <IconButton onClick={() => setSelectedWarehouse(null)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            {/* Info Summary */}
            <Box sx={{ my: 2, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Ubicación:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedWarehouse.city}, {selectedWarehouse.country}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Región/Continente:</Typography>
                <Typography variant="body2">{selectedWarehouse.continent}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Ocupación:</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedWarehouse.currentOccupancy || 0} / {selectedWarehouse.warehouseCapacity || 500}
                  </Typography>
                  <SemaphoreChip occupancyPct={selectedWarehouse.occupancy || 0} />
                </Box>
              </Box>
              {selectedWarehouse.nextDeparture && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Próxima Salida:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedWarehouse.nextDepartureFlight} ({formatFlightTime(selectedWarehouse.nextDeparture)})
                  </Typography>
                </Box>
              )}
              {selectedWarehouse.nextArrival && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Próxima Llegada:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedWarehouse.nextArrivalFlight} ({formatFlightTime(selectedWarehouse.nextArrival)})
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Tabs inside Drawer */}
            <Tabs
              value={detailTab}
              onChange={(e, v) => setDetailTab(v)}
              variant="fullWidth"
              sx={{ minHeight: 36, mt: 1, '& .MuiTab-root': { py: 1, minHeight: 36, fontSize: '0.75rem' } }}
            >
              <Tab label="Stock" />
              <Tab label="Flujos UT" />
            </Tabs>

            {/* Tab Panels */}
            <Box sx={{ flex: 1, overflowY: 'auto', mt: 1 }}>
              {detailTab === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Transit shipments (waiting departure) */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565C0', mb: 0.5 }}>
                      En tránsito / Por Salir ({warehouseDetails.transitShipments.length})
                    </Typography>
                    <List dense>
                      {warehouseDetails.transitShipments.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>Ninguno</Typography>
                      ) : (
                        warehouseDetails.transitShipments.map(s => (
                          <ListItem key={s.id} sx={{ px: 0, py: 0.2 }}>
                            <ListItemText
                              primary={<Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{s.id}</Typography>}
                              secondary={`Destino: ${s.destination}`}
                            />
                            <Chip label={`${s.totalBags} maletas`} size="small" variant="outlined" />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>

                  <Divider />

                  {/* Delivered shipments (final destination here) */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2E7D32', mb: 0.5 }}>
                      Destino Final / Entregado ({warehouseDetails.deliveredShipments.length})
                    </Typography>
                    <List dense>
                      {warehouseDetails.deliveredShipments.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>Ninguno</Typography>
                      ) : (
                        warehouseDetails.deliveredShipments.map(s => (
                          <ListItem key={s.id} sx={{ px: 0, py: 0.2 }}>
                            <ListItemText
                              primary={<Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{s.id}</Typography>}
                              secondary={`Cliente: ${s.client}`}
                            />
                            <Chip label={`${s.totalBags} maletas`} size="small" color="success" variant="outlined" />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Incoming flights */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E65100', mb: 0.5 }}>
                      Vuelos Entrantes / Incoming ({warehouseDetails.incomingFlights.length})
                    </Typography>
                    <List dense>
                      {warehouseDetails.incomingFlights.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>Ninguno</Typography>
                      ) : (
                        warehouseDetails.incomingFlights.map(f => (
                          <ListItem key={f.id} sx={{ px: 0, py: 0.2 }}>
                            <ListItemText
                              primary={<Typography variant="caption" sx={{ fontWeight: 700 }}>{f.id}</Typography>}
                              secondary={`Origen: ${f.origin} | Llegada: ${formatFlightTime(f.arrivalUTC)}`}
                            />
                            <Chip label={`${f.bagsAboard} maletas`} size="small" color="warning" variant="outlined" />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>

                  <Divider />

                  {/* Outgoing flights */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5 }}>
                      Vuelos Salientes / Outgoing ({warehouseDetails.outgoingFlights.length})
                    </Typography>
                    <List dense>
                      {warehouseDetails.outgoingFlights.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>Ninguno</Typography>
                      ) : (
                        warehouseDetails.outgoingFlights.map(f => (
                          <ListItem key={f.id} sx={{ px: 0, py: 0.2 }}>
                            <ListItemText
                              primary={<Typography variant="caption" sx={{ fontWeight: 700 }}>{f.id}</Typography>}
                              secondary={`Destino: ${f.destination} | Salida: ${formatFlightTime(f.departureUTC)}`}
                            />
                            <Chip label={`${f.bagsAboard} maletas`} size="small" variant="outlined" />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  )
}
