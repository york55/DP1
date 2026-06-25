import { useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'

import DataTable from '../common/DataTable'

const STATUS_STYLES = {
  PLANNED: {
    label: 'Planificado',
    color: '#1565C0',
    bg: '#E3F2FD',
  },

  IN_TRANSIT: {
    label: 'En Tránsito',
    color: '#E65100',
    bg: '#FFF3E0',
  },

  IN_FLIGHT: {
    label: 'En vuelo',
    color: '#E65100',
    bg: '#FFF3E0',
  },

  DELIVERED: {
    label: 'Entregado',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },

  DELAYED: {
    label: 'Retrasado',
    color: '#C62828',
    bg: '#FFEBEE',
  },
}

function StatusChip({ status }) {
  const style =
    STATUS_STYLES[status] ||
    {
      label: status,
      color: '#6B7280',
      bg: '#F2F2F2',
    }

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

export default function OpsShipmentsTab({
  shipments = [],
}) {

  const [selectedShipment, setSelectedShipment] =
    useState(null)

  const [search, setSearch] =
    useState('')

  const [originFilter, setOriginFilter] =
    useState('ALL')

  const [destFilter, setDestFilter] =
    useState('ALL')

  const [tab, setTab] =
    useState(0)

  const origins = useMemo(() => {
    return [
      ...new Set(
        shipments.map(s => s.originIata)
      ),
    ].sort()
  }, [shipments])

  const destinations = useMemo(() => {
    return [
      ...new Set(
        shipments.map(s => s.destIata)
      ),
    ].sort()
  }, [shipments])

  const shipmentCounts =
    useMemo(() => {

      const counts = {
        PLANNED: 0,
        IN_TRANSIT: 0,
        IN_FLIGHT: 0,
        DELIVERED: 0,
        DELAYED: 0,
      }

      shipments.forEach(s => {
        if (counts[s.status] !== undefined) {
          counts[s.status]++
        }
      })

      return counts

    }, [shipments])

  const filteredShipments =
    useMemo(() => {

      return shipments.filter(s => {

        const matchesSearch =
          !search ||
          s.externalId
            ?.toLowerCase()
            .includes(search.toLowerCase())

        const matchesOrigin =
          originFilter === 'ALL' ||
          s.originIata === originFilter

        const matchesDest =
          destFilter === 'ALL' ||
          s.destIata === destFilter

        if (
          !matchesSearch ||
          !matchesOrigin ||
          !matchesDest
        ) {
          return false
        }

        if (tab === 1)
          return s.status === 'PLANNED'

        if (tab === 2)
          return s.status === 'IN_TRANSIT' || s.status === 'IN_FLIGHT'

        if (tab === 3)
          return s.status === 'DELIVERED'

        if (tab === 4)
          return s.status === 'DELAYED'

        return true

      })

    }, [
      shipments,
      search,
      originFilter,
      destFilter,
      tab,
    ])

  const columns = [

    {
      field: 'externalId',
      headerName: 'ID Envío',
      width: 120,
    },

    {
      field: 'route',
      headerName: 'Ruta',
      width: 110,

      valueGetter: params =>
        `${params.row.originIata} → ${params.row.destIata}`,
    },

    {
      field: 'bagCount',
      headerName: 'Maletas',
      width: 100,
    },

    {
      field: 'status',
      headerName: 'Estado',
      width: 120,

      renderCell: params =>
        <StatusChip status={params.value} />
    },

  ]

  if (selectedShipment) {

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1,
            py: 1,
          }}
        >

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >

            <IconButton
              size="small"
              onClick={() =>
                setSelectedShipment(null)
              }
            >
              <ArrowBackIcon />
            </IconButton>

            <Typography
              sx={{
                fontWeight: 700,
                color: '#1F3864',
              }}
            >
              {selectedShipment.externalId}
            </Typography>

          </Box>

          <IconButton
            size="small"
            onClick={() =>
              setSelectedShipment(null)
            }
          >
            <CloseIcon />
          </IconButton>

        </Box>

        <Divider />

        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >

          <Typography>
            Ruta:
            {' '}
            <b>
              {selectedShipment.originIata}
              {' → '}
              {selectedShipment.destIata}
            </b>
          </Typography>

          <Typography>
            Maletas:
            {' '}
            {selectedShipment.bagCount}
          </Typography>

          <Typography>
            Estado:
            {' '}
            <StatusChip
              status={selectedShipment.status}
            />
          </Typography>

          <Typography>
            Registrado:
            {' '}
            {selectedShipment.registeredAt}
          </Typography>

          <Typography>
            Deadline:
            {' '}
            {selectedShipment.deadlineUtc}
          </Typography>

        </Box>

      </Box>
    )
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >

      {/* Resumen */}

      <Box
        sx={{
          px: 1,
          pt: 1,
          display: 'flex',
          gap: 0.5,
          flexWrap: 'wrap',
        }}
      >

        {Object.entries(STATUS_STYLES)
          .filter(([status]) => status !== 'IN_FLIGHT') // IN_FLIGHT se suma a IN_TRANSIT
          .map(([status, style]) => {
            const count = status === 'IN_TRANSIT'
              ? (shipmentCounts['IN_TRANSIT'] || 0) + (shipmentCounts['IN_FLIGHT'] || 0)
              : (shipmentCounts[status] || 0)
            return (
              <Chip
                key={status}
                label={`${style.label}: ${count}`}
                size="small"
                sx={{
                  backgroundColor: style.bg,
                  color: style.color,
                  border: `1px solid ${style.color}`,
                  fontWeight: 600,
                }}
              />
            )
          })}
      </Box>

      {/* Filtros */}

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          px: 1,
          flexWrap: 'wrap',
        }}
      >

        <TextField
          size="small"
          label="Buscar"
          value={search}
          onChange={e =>
            setSearch(e.target.value)
          }
          sx={{ flex: 1 }}
        />

        <TextField
          select
          size="small"
          label="Origen"
          value={originFilter}
          onChange={e =>
            setOriginFilter(e.target.value)
          }
          sx={{ width: 95 }}
        >
          <MenuItem value="ALL">
            Todos
          </MenuItem>

          {origins.map(o => (
            <MenuItem
              key={o}
              value={o}
            >
              {o}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Destino"
          value={destFilter}
          onChange={e =>
            setDestFilter(e.target.value)
          }
          sx={{ width: 95 }}
        >
          <MenuItem value="ALL">
            Todos
          </MenuItem>

          {destinations.map(d => (
            <MenuItem
              key={d}
              value={d}
            >
              {d}
            </MenuItem>
          ))}
        </TextField>

      </Box>

      {/* Tabs */}

      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Todos" />
        <Tab label="Planificados" />
        <Tab label="En Tránsito" />
        <Tab label="Entregados" />
        <Tab label="Retrasados" />
      </Tabs>

      {/* Tabla */}

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
        }}
      >

        <DataTable
          rows={filteredShipments}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={(params) =>
            setSelectedShipment(params.row)
          }
        />

      </Box>

    </Box>
  )
}