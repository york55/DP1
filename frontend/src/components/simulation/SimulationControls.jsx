import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CancelIcon from '@mui/icons-material/Cancel'
import { useSimulationContext } from '../../context/SimulationContext'

export default function SimulationControls() {
  const navigate = useNavigate()
  const { simulationState, pauseSimulation, resumeSimulation, cancelSimulation } = useSimulationContext()
  const { status } = simulationState

  const [confirmOpen, setConfirmOpen] = useState(false)

  const isPaused = status === 'paused'
  const isRunning = status === 'running'
  const isIdle = status === 'idle'
  const isFinished = status === 'finished'

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<PauseIcon />}
          onClick={pauseSimulation}
          disabled={!isRunning}
          size="small"
          sx={{
            backgroundColor: '#E65100',
            '&:hover': { backgroundColor: '#BF360C' },
            '&.Mui-disabled': { backgroundColor: '#BFBFBF' },
          }}
        >
          Pausar
        </Button>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={resumeSimulation}
          disabled={isRunning || isIdle || isFinished}
          size="small"
          sx={{
            backgroundColor: '#2E7D32',
            '&:hover': { backgroundColor: '#1B5E20' },
            '&.Mui-disabled': { backgroundColor: '#BFBFBF' },
          }}
        >
          Reanudar
        </Button>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={isIdle || isFinished}
          size="small"
          sx={{
            borderColor: '#C62828',
            color: '#C62828',
            '&:hover': { borderColor: '#B71C1C', backgroundColor: 'rgba(198,40,40,0.08)' },
            '&.Mui-disabled': { borderColor: '#BFBFBF', color: '#BFBFBF' },
          }}
        >
          Cancelar
        </Button>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1F3864' }}>
          ¿Cancelar simulación?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se detendrá la simulación en curso y se perderá el progreso actual.
            Serás redirigido a la pantalla de configuración.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)} variant="outlined" size="small">
            Continuar simulación
          </Button>
          <Button
            onClick={async () => { setConfirmOpen(false); await cancelSimulation(); navigate('/simulation/config') }}
            variant="contained"
            size="small"
            color="error"
          >
            Sí, cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
