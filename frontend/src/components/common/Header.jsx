import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LuggageIcon from '@mui/icons-material/Luggage'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

/**
 * @param {string}   subtitle
 * @param {string}   backTo
 * @param {object}   [user]      - { fullName, airportIata, airportName, airportGmtOffset }
 * @param {Function} [onLogout]  - callback para cerrar sesión (si se pasa, muestra el botón)
 */
export default function AppHeader({ subtitle = '', backTo = '/', user = null, onLogout = null }) {
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const utcClock = now.toUTCString().slice(17, 25) + ' UTC'

  const gmtOffset = user?.airportGmtOffset
  let localClock = null
  if (typeof gmtOffset === 'number') {
    const localMs = now.getTime() + gmtOffset * 3600 * 1000
    const localDate = new Date(localMs)
    const hh = String(localDate.getUTCHours()).padStart(2, '0')
    const mm = String(localDate.getUTCMinutes()).padStart(2, '0')
    const ss = String(localDate.getUTCSeconds()).padStart(2, '0')
    const sign = gmtOffset >= 0 ? '+' : ''
    localClock = `${hh}:${mm}:${ss} ${user.airportIata} (GMT${sign}${gmtOffset})`
  }

  return (
    <AppBar position="static" sx={{ backgroundColor: '#1F3864', zIndex: 10 }}>
      <Toolbar variant="dense">
        <IconButton
          edge="start"
          color="inherit"
          onClick={() => navigate(backTo)}
          sx={{ mr: 1 }}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <LuggageIcon sx={{ mr: 1, fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mr: 0.5 }}>
          Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
        </Typography>
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', mx: 2, my: 0.5 }} />
        <Typography variant="body2" sx={{ color: '#90CAF9', fontSize: '0.78rem' }}>
          {subtitle}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {user && (
          <>
            <PersonIcon sx={{ color: '#90CAF9', fontSize: 18, mr: 0.75 }} />
            <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, mr: 0.5 }}>
              {user.fullName}
            </Typography>
            {user.airportIata && (
              <Typography sx={{ color: '#90CAF9', fontSize: '0.78rem' }}>
                · {user.airportIata}{user.airportName ? ` (${user.airportName})` : ''}
              </Typography>
            )}
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', mx: 2, my: 0.5 }} />
          </>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: onLogout ? 1.5 : 0 }}>
          <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.3 }}>
            {utcClock}
          </Typography>
          {localClock && (
            <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.3 }}>
              {localClock}
            </Typography>
          )}
        </Box>

        {onLogout && (
          <Tooltip title="Cerrar sesión">
            <IconButton size="small" onClick={onLogout} sx={{ color: '#90CAF9' }}>
              <LogoutIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  )
}
