import React, { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import DataTable from '../common/DataTable'
import { useSimulationContext } from '../../context/SimulationContext'

const STATUS_STYLES = {
  IN_ORIGIN: { label: 'En Almacén', color: '#1565C0', bg: '#E3F2FD' },
  IN_TRANSIT: { label: 'En Tránsito', color: '#E65100', bg: '#FFF3E0' },
  DELIVERED: { label: 'Entregado', color: '#2E7D32', bg: '#E8F5E9' },
  DELAYED: { label: 'Retrasado', color: '#C62828', bg: '#FFEBEE' },
}

function StatusChip({ status }) {
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

export default function ShipmentsTab() {
  const { shipments, flights, simulationState, shipmentCounts = {} } = useSimulationContext()
  const { simulatedTime } = simulationState

  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('ALL')
  const [destFilter, setDestFilter] = useState('ALL')
  const [currentTab, setCurrentTab] = useState(0) // 0: Todos, 1: Planificados, 2: En Tránsito, 3: Entregados, 4: Recientes (<4h)

  // Get unique airports for filter dropdowns
  const origins = useMemo(() => {
    const set = new Set(shipments.map(s => s.origin).filter(Boolean))
    return Array.from(set).sort()
  }, [shipments])

  const destinations = useMemo(() => {
    const set = new Set(shipments.map(s => s.destination).filter(Boolean))
    return Array.from(set).sort()
  }, [shipments])

  // Resolve active flight for in-transit shipments
  const shipmentsWithFlights = useMemo(() => {
    return shipments.map(s => {
      let resolvedFlight = null
      if (s.status === 'IN_TRANSIT') {
        const matchingFlight = flights.find(f =>
          f.status === 'IN_FLIGHT' &&
          (f.origin === s.origin || f.destination === s.destination)
        )
        if (matchingFlight) resolvedFlight = matchingFlight.id
      }
      return {
        ...s,
        currentFlight: resolvedFlight,
      }
    })
  }, [shipments, flights])

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipmentsWithFlights.filter(s => {
      const matchesSearch = s.id.toString().includes(search) ||
        s.client.toLowerCase().includes(search.toLowerCase())
      const matchesOrigin = originFilter === 'ALL' || s.origin === originFilter
      const matchesDest = destFilter === 'ALL' || s.destination === destFilter

      if (!matchesSearch || !matchesOrigin || !matchesDest) return false

      // Tab filters
      if (currentTab === 1) return s.status === 'IN_ORIGIN'
      if (currentTab === 2) return s.status === 'IN_TRANSIT'
      if (currentTab === 3) return s.status === 'DELIVERED'
      if (currentTab === 4) {
        if (s.status !== 'DELIVERED' || !s.deliveredAt || !simulatedTime) return false
        const deliveryDate = new Date(s.deliveredAt)
        const diffMs = simulatedTime.getTime() - deliveryDate.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        return diffHours >= 0 && diffHours <= 4
      }

      return true
    })
  }, [shipmentsWithFlights, search, originFilter, destFilter, currentTab, simulatedTime])

  const columns = [
    {
      field: 'id',
      headerName: 'ID Envío',
      width: 110,
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
      field: 'deliveredBags',
      headerName: 'Maletas',
      width: 120,
      renderCell: (params) => `${params.row.deliveredBags} / ${params.row.totalBags}`,
    },
    {
      field: 'currentFlight',
      headerName: 'Vuelo Actual',
      width: 110,
      renderCell: (params) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {params.value || '—'}
        </span>
      ),
    },
    {
      field: 'status',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'client',
      headerName: 'Cliente',
      width: 90,
    },
  ]

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Live counts summary */}
      <Box sx={{ px: 1, pt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_STYLES).map(([statusKey, style]) => {
          const count = shipmentCounts[statusKey] || 0
          return (
            <Chip
              key={statusKey}
              label={`${style.label}: ${count}`}
              size="small"
              sx={{
                backgroundColor: style.bg,
                color: style.color,
                fontWeight: 600,
                fontSize: '0.68rem',
                height: 20,
                border: `1px solid ${style.color}`,
              }}
            />
          )
        })}
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 1 }}>
        <TextField
          size="small"
          label="Buscar ID/Cliente"
          placeholder="Ej. Latam"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: '130px' }}
        />
        <TextField
          select
          size="small"
          label="Origen"
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          sx={{ width: '95px' }}
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
          sx={{ width: '95px' }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          {destinations.map(code => (
            <MenuItem key={code} value={code}>{code}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Sub-Tabs */}
      <Tabs
        value={currentTab}
        onChange={(e, v) => setCurrentTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 32,
          borderBottom: '1px solid #BFBFBF',
          '& .MuiTab-root': {
            py: 0.5,
            px: 1,
            minHeight: 32,
            fontSize: '0.7rem',
            textTransform: 'none',
          }
        }}
      >
        <Tab label="Todos" />
        <Tab label="Planificados" />
        <Tab label="En Tránsito" />
        <Tab label="Entregados" />
        <Tab label="Entregados (<4h)" />
      </Tabs>

      {/* Shipments Table */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          rows={filteredShipments}
          columns={columns}
        />
      </Box>
    </Box>
  )
}
