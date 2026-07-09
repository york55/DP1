// src/components/ops/OpsPanel.jsx

import { useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'

import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FlightIcon from '@mui/icons-material/Flight'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import BarChartIcon from '@mui/icons-material/BarChart'

import OpsShipmentsTab from './OpsShipmentsTab'
import OpsFlightsTab from './OpsFlightsTab'
import OpsWarehousesTab from './OpsWarehousesTab'
import OpsKpiTab from './OpsKpiTab'

export default function OpsPanel({
  airports = [],
  flights = [],
  shipments = [],
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentId,
  onFlightSelected,
  onAirportSelected,
  onShipmentFocus,
  warehouseFilters,
  onWarehouseFiltersChange,
  onlyWithShipments,
  onOnlyWithShipmentsChange,

}) {
  const [tab, setTab] = useState(0)

  return (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={tab}
        onChange={(e, value) => setTab(value)}
        variant="fullWidth"
        sx={{
          backgroundColor: '#1F3864',

          '& .MuiTab-root': {
            color: '#90CAF9',
            minHeight: 44,
            textTransform: 'none',
            fontSize: '0.75rem',
          },

          '& .MuiTab-root.Mui-selected': {
            color: '#fff',
            fontWeight: 700,
          },
        }}
      >
        <Tab icon={<LocalShippingIcon />} label="Envíos" />
        <Tab icon={<FlightIcon />} label="Vuelos" />
        <Tab icon={<WarehouseIcon />} label="Almacenes" />
        <Tab icon={<BarChartIcon />} label="KPIs" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && <OpsShipmentsTab
          shipments={shipments}
          selectedShipmentId={selectedShipmentId}
          onShipmentFocus={onShipmentFocus}
        />}
        {tab === 1 && (
          <OpsFlightsTab
            flights={flights}
            shipments={shipments}
            selectedFlightId={selectedFlightId}
            onFlightSelected={onFlightSelected}
            onlyWithShipments={onlyWithShipments}
            onOnlyWithShipmentsChange={onOnlyWithShipmentsChange}
          />
        )}
        {tab === 2 && <OpsWarehousesTab
          airports={airports}
          flights={flights}
          shipments={shipments}
          selectedAirportCode={
            selectedAirportCode
          }
          onAirportSelected={onAirportSelected}
          filters={warehouseFilters}
          onFiltersChange={onWarehouseFiltersChange}
        />}
        {tab === 3 && (
          <OpsKpiTab
            airports={airports}
            flights={flights}
          />
        )}
      </Box>
    </Paper>
  )
}