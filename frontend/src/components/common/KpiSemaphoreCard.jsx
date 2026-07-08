import React from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import SemaphoreChip from './SemaphoreChip'

/**
 * KpiSemaphoreCard — same 170x90 footprint as KpiCard, but shows the value
 * as a red/amber/green SemaphoreChip instead of a trend arrow.
 */
export default function KpiSemaphoreCard({ label, occupancyPct }) {
  return (
    <Paper
      elevation={2}
      sx={{
        width: 170,
        height: 90,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', lineHeight: 1.2, fontWeight: 500, fontSize: '0.68rem' }}
        noWrap
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <SemaphoreChip occupancyPct={occupancyPct} />
      </Box>
    </Paper>
  )
}
