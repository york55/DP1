import React, { useEffect, useRef } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Badge from '@mui/material/Badge'
import NotificationsIcon from '@mui/icons-material/Notifications'
import IconButton from '@mui/material/IconButton'
import { useSimulationContext } from '../../context/SimulationContext'

/**
 * NotificationStack — manages a queue of snackbar notifications.
 * Auto-dismisses info/success notifications after 6 seconds.
 * Persistent (error/warning) alerts stack up and require manual dismissal.
 */
export default function NotificationStack() {
  const { notifications, dismissNotification } = useSimulationContext()
  const timerRefs = useRef({})

  const active = notifications.filter(n => !n.dismissed)
  // Show at most 3 stacked at a time
  const visible = active.slice(-3)
  const pendingCount = active.length

  useEffect(() => {
    active.forEach(n => {
      if (!n.persistent && !timerRefs.current[n.id]) {
        timerRefs.current[n.id] = setTimeout(() => {
          dismissNotification(n.id)
          delete timerRefs.current[n.id]
        }, 6000)
      }
    })
  }, [active, dismissNotification])

  // Clean up timers for dismissed notifications
  useEffect(() => {
    const dismissed = notifications.filter(n => n.dismissed)
    dismissed.forEach(n => {
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
      {visible.map((n, i) => (
        <Alert
          key={n.id}
          severity={n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'}
          onClose={() => dismissNotification(n.id)}
          sx={{
            boxShadow: 3,
            opacity: 0.95,
            fontSize: '0.8rem',
            transition: 'all 0.3s',
          }}
        >
          {n.message}
        </Alert>
      ))}
    </Box>
  )
}
