import React from 'react'
import Chip from '@mui/material/Chip'
import DataTable from '../common/DataTable'
import { useSimulationContext } from '../../context/SimulationContext'

const STATUS_STYLES = {
  PLANNED: { label: 'En Origen', color: '#1565C0', bg: '#E3F2FD' },
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
    field: 'deliveredBags',
    headerName: '# Maletas Entregadas',
    width: 170,
    renderCell: (params) => `${params.value} / ${params.row.totalBags}`,
  },
  {
    field: 'status',
    headerName: 'Estado',
    width: 140,
    renderCell: (params) => <StatusChip status={params.value} />,
  },
  {
    field: 'client',
    headerName: 'Cliente',
    width: 100,
  },
  {
    field: 'origin',
    headerName: 'Origen',
    width: 90,
  },
  {
    field: 'destination',
    headerName: 'Destino',
    width: 90,
  },
  {
    field: 'currentFlight',
    headerName: 'Vuelo Actual',
    width: 120,
    renderCell: (params) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {params.value || '—'}
      </span>
    ),
  },
]

export default function ShipmentsTab() {
  const { shipments } = useSimulationContext()

  return (
    <DataTable
      rows={shipments}
      columns={columns}
    />
  )
}
