import React from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FlightIcon from '@mui/icons-material/Flight'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import LuggageIcon from '@mui/icons-material/Luggage'
import BarChartIcon from '@mui/icons-material/BarChart'
import ShipmentsTab from './ShipmentsTab'
import FlightsTab from './FlightsTab'
import WarehousesTab from './WarehousesTab'
import BagsTab from './BagsTab'
import KpiPanel from './KpiPanel'
import { useSimulationContext } from '../../context/SimulationContext'

function TabLabel({ icon, text }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {icon}
      <span>{text}</span>
    </Box>
  )
}

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ overflow: 'auto', flex: 1 }}
    >
      {value === index && (
        <Box sx={{ pt: 1 }}>
          {children}
        </Box>
      )}
    </Box>
  )
}

export default function SimulationPanel() {
  const { activePanelTab, setActivePanelTab } = useSimulationContext()

  const handleChange = (event, newValue) => {
    setActivePanelTab(newValue)
  }

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 1,
      }}
    >
      <Tabs
        value={activePanelTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          backgroundColor: '#1F3864',
          '& .MuiTab-root': {
            color: '#90CAF9',
            fontSize: '0.70rem',
            minHeight: 44,
            px: 0.5,
            py: 0.5,
            textTransform: 'none',
          },
          '& .MuiTab-root.Mui-selected': {
            color: '#FFFFFF !important',
            fontWeight: 700,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#2E75B6',
            height: 3,
          },
        }}
      >
        <Tab label={<TabLabel icon={<LocalShippingIcon sx={{ fontSize: 15 }} />} text="Envíos" />} />
        <Tab label={<TabLabel icon={<FlightIcon sx={{ fontSize: 15 }} />} text="Vuelos" />} />
        <Tab label={<TabLabel icon={<WarehouseIcon sx={{ fontSize: 15 }} />} text="Almacenes" />} />
        <Tab label={<TabLabel icon={<LuggageIcon sx={{ fontSize: 15 }} />} text="Maletas" />} />
        <Tab label={<TabLabel icon={<BarChartIcon sx={{ fontSize: 15 }} />} text="KPIs" />} />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        <TabPanel value={activePanelTab} index={0}>
          <ShipmentsTab />
        </TabPanel>
        <TabPanel value={activePanelTab} index={1}>
          <FlightsTab />
        </TabPanel>
        <TabPanel value={activePanelTab} index={2}>
          <WarehousesTab />
        </TabPanel>
        <TabPanel value={activePanelTab} index={3}>
          <BagsTab />
        </TabPanel>
        <TabPanel value={activePanelTab} index={4}>
          <KpiPanel />
        </TabPanel>
      </Box>
    </Paper>
  )
}

