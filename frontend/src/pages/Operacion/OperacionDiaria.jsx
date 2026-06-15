import { useState } from 'react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import LuggageIcon from '@mui/icons-material/Luggage'
import FlightLandIcon from '@mui/icons-material/FlightLand'
import MapIcon from '@mui/icons-material/Map'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AppHeader from '../../components/common/Header'
import BaggageRegistrationPage from './BaggageRegistrationPage'
import FlightCancellationPage from './FlightCancellationPage'
import RealtimeMapPage from './RealtimeMapPage'

const NAV_ITEMS = [
  { key: 'baggage',      label: 'Registro de Maletas',         icon: <LuggageIcon /> },
  { key: 'cancellation', label: 'Cancelación de Vuelos',       icon: <FlightLandIcon /> },
  { key: 'map',          label: 'Visualización en Tiempo Real', icon: <MapIcon /> },
]

const PAGES = {
  baggage:      <BaggageRegistrationPage />,
  cancellation: <FlightCancellationPage />,
  map:          <RealtimeMapPage />,
}

export default function RealtimeOperationsPage() {
  const [active, setActive] = useState('baggage')
  const [collapsed, setCollapsed] = useState(false)

  const DRAWER_WIDTH = collapsed ? 64 : 240

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2' }}>
      <AppHeader subtitle="Operaciones en Tiempo Real" backTo="/" />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            transition: 'width 0.2s',
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              position: 'relative',
              backgroundColor: '#1F3864',
              color: '#FFFFFF',
              border: 'none',
              overflow: 'hidden',
              transition: 'width 0.2s',
            },
          }}
        >
          {/* Header sidebar */}
          <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!collapsed && (
              <Typography variant="caption" sx={{ color: '#90CAF9', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                MÓDULOS
              </Typography>
            )}
            <IconButton
              onClick={() => setCollapsed(!collapsed)}
              size="small"
              sx={{ color: '#90CAF9', ml: collapsed ? 'auto' : 0 }}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: '#2E75B6' }} />

          <List disablePadding>
            {NAV_ITEMS.map(({ key, label, icon }) => (
              <ListItemButton
                key={key}
                selected={active === key}
                onClick={() => setActive(key)}
                sx={{
                  px: 2,
                  py: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: '#2E75B6',
                    '&:hover': { backgroundColor: '#2E75B6' },
                  },
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <ListItemIcon sx={{ color: active === key ? '#FFFFFF' : '#90CAF9', minWidth: 36 }}>
                  {icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      fontSize: '0.82rem',
                      fontWeight: active === key ? 700 : 400,
                      color: active === key ? '#FFFFFF' : '#90CAF9',
                    }}
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        </Drawer>

        {/* Contenido */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'auto' }}>
          {PAGES[active]}
        </Box>
      </Box>
    </Box>
  )
}