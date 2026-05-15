import React from 'react'
import Chip from '@mui/material/Chip'
import DataTable from '../common/DataTable'
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

const columns = [
  {
    field: 'id',
    headerName: 'ID',
    width: 110,
    renderCell: (params) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{params.value}</span>
    ),
  },
  {
    field: 'airline',
    headerName: 'Aerolínea',
    width: 90,
  },
  {
    field: 'capacity',
    headerName: 'Capacidad',
    width: 100,
    type: 'number',
  },
  {
    field: 'bagsAboard',
    headerName: 'Maletas',
    width: 90,
    type: 'number',
    renderCell: (params) => `${params.value} / ${params.row.capacity}`,
  },
  {
    field: 'route',
    headerName: 'Ruta',
    width: 100,
    valueGetter: (value, row) => `${row.origin} → ${row.destination}`,
  },
  {
    field: 'departureUTC',
    headerName: 'Salida UTC',
    width: 110,
    renderCell: (params) => formatFlightTime(params.value),
  },
  {
    field: 'arrivalUTC',
    headerName: 'Llegada UTC',
    width: 110,
    renderCell: (params) => formatFlightTime(params.value),
  },
  {
    field: 'status',
    headerName: 'Estado',
    width: 130,
    renderCell: (params) => <FlightStatusChip status={params.value} />,
  },
]

export default function FlightsTab() {
  const { flights } = useSimulationContext()

  return (
    <DataTable
      rows={flights}
      columns={columns}
    />
  )
}
