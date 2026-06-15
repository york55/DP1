import React from 'react'
import Chip from '@mui/material/Chip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import { getSemaphoreLevel } from '../../utils/semaphoreUtils'

const ICON_MAP = {
  CheckCircle: CheckCircleIcon,
  Info: InfoIcon,
  Warning: WarningIcon,
  Error: ErrorIcon,
}

/**
 * SemaphoreChip — displays occupancy level as a colored MUI Chip.
 * @param {number} occupancyPct - 0 to 100
 * @param {number} thresholdAmber - default 75
 * @param {number} thresholdRed - default 90
 */
export default function SemaphoreChip({ occupancyPct, thresholdAmber = 75, thresholdRed = 90 }) {
  const pct = typeof occupancyPct === 'number' ? occupancyPct : 0
  const level = getSemaphoreLevel(pct, thresholdAmber, thresholdRed)
  const IconComponent = ICON_MAP[level.iconName] || InfoIcon

  return (
    <Chip
      icon={<IconComponent style={{ color: '#ffffff' }} />}
      label={`${level.label} ${pct.toFixed(0)}%`}
      size="small"
      sx={{
        backgroundColor: level.color,
        color: '#ffffff',
        fontWeight: 600,
        '& .MuiChip-icon': {
          color: '#ffffff',
        },
      }}
    />
  )
}
