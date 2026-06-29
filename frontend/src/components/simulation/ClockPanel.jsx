import React, { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PublicIcon from '@mui/icons-material/Public'
import { formatUTCFull, formatElapsed } from '../../utils/timeUtils'

function formatSimElapsed(simulatedTime, startDate) {
  if (!simulatedTime || !startDate) return '--d --:--:--'
  const ms = simulatedTime.getTime() - new Date(startDate).getTime()
  if (ms < 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600) % 24
  const d = Math.floor(totalSec / 86400)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatRealDatetime(date) {
  if (!date) return '-- --- ---- --:--:--'
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const day = String(date.getDate()).padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const sec = String(date.getSeconds()).padStart(2, '0')
  return `${days[date.getDay()]} ${day} ${month} ${year} ${h}:${min}:${sec}`
}

export default function ClockPanel({ simulatedTime, elapsedSeconds, startDate }) {
  const [now, setNow] = useState(() => new Date())
  const [pos, setPos] = useState({ x: 52, y: 55 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const onMouseDown = (e) => {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const onUp = () => { dragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 3000,
        backgroundColor: 'rgba(15, 30, 60, 0.88)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(144, 202, 249, 0.25)',
        borderRadius: '8px',
        minWidth: 220,
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        userSelect: 'none',
      }}
    >
      {/* Drag handle */}
      <Box
        onMouseDown={onMouseDown}
        sx={{
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.6,
          borderBottom: '1px solid rgba(144, 202, 249, 0.15)',
          backgroundColor: 'rgba(31, 56, 100, 0.7)',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <Box sx={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'rgba(144,202,249,0.4)' }} />
          ))}
        </Box>
        <Typography sx={{ color: 'rgba(144,202,249,0.7)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1, textAlign: 'center' }}>
          Cronómetros
        </Typography>
      </Box>

      {/* Real time section */}
      <Box sx={{ px: 1.5, pt: 1, pb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
          <AccessTimeIcon sx={{ fontSize: 11, color: '#64B5F6' }} />
          <Typography sx={{ color: '#64B5F6', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Tiempo Real
          </Typography>
        </Box>
        <Typography sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.4 }}>
          {formatRealDatetime(now)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem' }}>transcurrido</Typography>
          <Typography sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}>
            {formatElapsed(elapsedSeconds || 0)}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ height: '1px', backgroundColor: 'rgba(144, 202, 249, 0.12)', mx: 1 }} />

      {/* Simulation time section */}
      <Box sx={{ px: 1.5, pt: 0.75, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
          <PublicIcon sx={{ fontSize: 11, color: '#A5D6A7' }} />
          <Typography sx={{ color: '#A5D6A7', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Simulación
          </Typography>
        </Box>
        <Typography sx={{ color: '#FFFFFF', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.4 }}>
          {simulatedTime ? formatUTCFull(simulatedTime) : '-- --- ---- --:--:-- UTC'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem' }}>transcurrido</Typography>
          <Typography sx={{ color: '#A5D6A7', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}>
            {formatSimElapsed(simulatedTime, startDate)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
