import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LuggageIcon from '@mui/icons-material/Luggage'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function AppHeader({ subtitle = '', backTo = '/' }) {
  const navigate = useNavigate()
  const [utcClock, setUtcClock] = useState('')

  useEffect(() => {
    const tick = () => setUtcClock(new Date().toUTCString().slice(17, 25) + ' UTC')
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

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
        <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.78rem' }}>
          {utcClock}
        </Typography>
      </Toolbar>
    </AppBar>
  )
}