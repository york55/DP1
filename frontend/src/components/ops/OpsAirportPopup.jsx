import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'

export default function OpsAirportPopup({ airport }) {

  const pct = airport.occupancyPct || 0

  return (
    <Box sx={{ minWidth: 220 }}>

      <Typography
        sx={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1F3864',
          lineHeight: 1,
        }}
      >
        {airport.iataCode}
      </Typography>

      <Typography
        sx={{
          fontSize: 13,
          color: '#6B7280',
        }}
      >
        {airport.name}
      </Typography>

      <Typography
        sx={{
          fontSize: 12,
          color: '#9CA3AF',
        }}
      >
        {airport.country}
      </Typography>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: 0.5,
          }}
        >
          <Typography fontSize={11}>
            Ocupación
          </Typography>

          <Typography
            fontSize={11}
            fontWeight={700}
          >
            {airport.assignedShipments} / {airport.capacity}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            height: 8,
            borderRadius: 4,
          }}
        />
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Typography fontSize={12}>
          Utilización
        </Typography>

        <Typography
          fontSize={12}
          fontWeight={700}
          color="#1F3864"
        >
          {pct.toFixed(2)}%
        </Typography>
      </Box>

    </Box>
  )
}