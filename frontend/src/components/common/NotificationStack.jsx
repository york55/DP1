import React, { useEffect, useRef } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { useSimulationContext } from '../../context/SimulationContext'

const AUTO_DISMISS_MS = 60_000

export default function NotificationStack() {
  const { notifications, dismissNotification } = useSimulationContext()
  const timerRefs = useRef({})

  const active = notifications.filter(n => !n.dismissed)
  const visible = active.slice(-3)

  useEffect(() => {
    active.forEach(n => {
      if (!timerRefs.current[n.id]) {
        timerRefs.current[n.id] = setTimeout(() => {
          dismissNotification(n.id)
          delete timerRefs.current[n.id]
        }, AUTO_DISMISS_MS)
      }
    })
  }, [active, dismissNotification])

  useEffect(() => {
    notifications.filter(n => n.dismissed).forEach(n => {
      if (timerRefs.current[n.id]) {
        clearTimeout(timerRefs.current[n.id])
        delete timerRefs.current[n.id]
      }
    })
  }, [notifications])

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 40,
        right: 16,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxWidth: 400,
      }}
    >
      {visible.map(n => (
        <Alert
          key={n.id}
          severity={n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'}
          onClose={() => dismissNotification(n.id)}
          sx={{ boxShadow: 3, opacity: 0.95, fontSize: '0.8rem' }}
        >
          {n.message}
        </Alert>
      ))}
    </Box>
  )
}
