import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useSimulationContext } from '../../context/SimulationContext'

export default function SimulationControls() {
  const { simulationState, pauseSimulation, resumeSimulation } = useSimulationContext()
  const { status } = simulationState

  const isPaused = status === 'paused'
  const isRunning = status === 'running'
  const isIdle = status === 'idle'
  const isFinished = status === 'finished'

  return (
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
    </Box>
  )
}
