import React, { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import DataTable from '../common/DataTable'
import { useSimulationContext } from '../../context/SimulationContext'

const STATUS_STYLES = {
  IN_ORIGIN: { label: 'En Almacén', color: '#1565C0', bg: '#E3F2FD' },
  IN_FLIGHT: { label: 'En Vuelo', color: '#E65100', bg: '#FFF3E0' },
  DELIVERED: { label: 'Entregado', color: '#2E7D32', bg: '#E8F5E9' },
  DELAYED: { label: 'Retrasado', color: '#C62828', bg: '#FFEBEE' },
}

function BagStatusChip({ status }) {
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
    headerName: 'ID Lote',
    width: 130,
    renderCell: (params) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{params.value}</span>
    ),
  },
  {
    field: 'shipmentId',
    headerName: 'ID Envío',
    width: 120,
    renderCell: (params) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{params.value}</span>
    ),
  },
  {
    field: 'bagCount',
    headerName: '# Maletas',
    width: 100,
    type: 'number',
  },
  {
    field: 'currentFlight',
    headerName: 'Vuelo Actual',
    width: 130,
    renderCell: (params) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {params.value || 'En almacén'}
      </span>
    ),
  },
  {
    field: 'status',
    headerName: 'Estado',
    width: 130,
    renderCell: (params) => <BagStatusChip status={params.value} />,
  },
]

/**
 * Generates bag lots from shipments. Each shipment gets 1-3 lots,
 * each lot is a deterministic subset of the shipment's bags.
 */
function generateBagLots(shipments) {
  const lots = []
  shipments.forEach((shipment, shipIdx) => {
    // Deterministic lot count based on total bags
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
        currentFlight: shipment.currentFlight,
        status: shipment.status,
        client: shipment.client || '',
        origin: shipment.origin || '',
        destination: shipment.destination || '',
      })
    }
  })
  return lots
}

export default function BagsTab() {
  const { shipments } = useSimulationContext()
  const [search, setSearch] = useState('')

  const bagLots = useMemo(() => generateBagLots(shipments), [shipments])

  const filteredBagLots = useMemo(() => {
    if (!search) return bagLots
    const q = search.toLowerCase()
    return bagLots.filter(b =>
      b.id.toLowerCase().includes(q) ||
      String(b.shipmentId).includes(q) ||
      (b.client || '').toLowerCase().includes(q) ||
      (b.origin || '').toLowerCase().includes(q) ||
      (b.destination || '').toLowerCase().includes(q) ||
      String(b.currentFlight || '').includes(q)
    )
  }, [bagLots, search])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Search */}
      <Box sx={{ px: 1, pt: 1 }}>
        <TextField
          size="small"
          fullWidth
          label="Buscar lote, envío, cliente, aeropuerto…"
          placeholder="Ej. LOT-001, SKBO, Latam"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      {/* Table */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          rows={filteredBagLots}
          columns={columns}
        />
      </Box>
    </Box>
  )
}
