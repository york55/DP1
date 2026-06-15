import React from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'

/**
 * KpiCard — 170x90px card showing a KPI metric with trend indicator.
 * @param {string} label - KPI label
 * @param {string|number} value - KPI value
 * @param {string} unit - unit string (e.g., '%', 'bags')
 * @param {'up'|'down'|'neutral'} trend - trend direction
 * @param {string} color - accent color for the value
 */
export default function KpiCard({ label, value, unit = '', trend = 'neutral', color = '#1F3864' }) {
  const TrendIcon =
    trend === 'up' ? TrendingUpIcon : trend === 'down' ? TrendingDownIcon : TrendingFlatIcon
  const trendColor = trend === 'up' ? '#2E7D32' : trend === 'down' ? '#C62828' : '#6B7280'

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
        borderTop: `3px solid ${color}`,
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
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
          <Typography
            sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color }}
          >
            {typeof value === 'number' ? value.toFixed(0) : value}
          </Typography>
          {unit && (
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5, fontWeight: 500 }}>
              {unit}
            </Typography>
          )}
        </Box>
        <TrendIcon sx={{ color: trendColor, fontSize: 20 }} />
      </Box>
    </Paper>
  )
}
