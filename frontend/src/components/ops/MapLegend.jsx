import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'

const LEGEND_ITEMS = [
  { color: '#2E7D32', label: 'Bajo (0–25%)' },
  { color: '#66BB6A', label: 'Moderado (25–50%)' },
  { color: '#FB8C00', label: 'Alto (50–75%)' },
  { color: '#E65100', label: 'Muy Alto (75–90%)' },
  { color: '#C62828', label: 'Crítico (90–100%)' },
]

export default function MapLegend() {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        bottom: 24,
        left: 10,
        zIndex: 1000,
        p: 1,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 1,
        minWidth: 160,
        pointerEvents: 'none',
      }}
    >
      <Typography
        sx={{
          fontWeight: 700,
          color: '#1F3864',
          mb: 0.5,
          fontSize: '0.68rem',
        }}
      >
        Ocupación Aeropuerto
      </Typography>

      {LEGEND_ITEMS.map(item => (
        <Box
          key={item.color}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 0.25,
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: item.color,
              border: '1px solid rgba(0,0,0,0.2)',
            }}
          />
          <Typography
            sx={{
              fontSize: '0.65rem',
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
    </Paper>
  )
}