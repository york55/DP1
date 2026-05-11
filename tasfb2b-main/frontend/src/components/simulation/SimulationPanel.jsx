import React, { useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FlightIcon from '@mui/icons-material/Flight'
import LuggageIcon from '@mui/icons-material/Luggage'
import BarChartIcon from '@mui/icons-material/BarChart'
import ShipmentsTab from './ShipmentsTab'
import FlightsTab from './FlightsTab'
import BagsTab from './BagsTab'
import KpiPanel from './KpiPanel'

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
  const [tab, setTab] = useState(0)

  const handleChange = (event, newValue) => {
    setTab(newValue)
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
        value={tab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          backgroundColor: '#1F3864',
          '& .MuiTab-root': {
            color: '#90CAF9',
            fontSize: '0.72rem',
            minHeight: 44,
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
        <Tab label={<TabLabel icon={<LocalShippingIcon sx={{ fontSize: 16 }} />} text="Envíos" />} />
        <Tab label={<TabLabel icon={<FlightIcon sx={{ fontSize: 16 }} />} text="Vuelos" />} />
        <Tab label={<TabLabel icon={<LuggageIcon sx={{ fontSize: 16 }} />} text="Maletas" />} />
        <Tab label={<TabLabel icon={<BarChartIcon sx={{ fontSize: 16 }} />} text="KPIs" />} />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        <TabPanel value={tab} index={0}>
          <ShipmentsTab />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <FlightsTab />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <BagsTab />
        </TabPanel>
        <TabPanel value={tab} index={3}>
          <KpiPanel />
        </TabPanel>
      </Box>
    </Paper>
  )
}
