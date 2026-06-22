import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

export default function OpsFlightPopup({ flight }) {

  const loadPct =
    flight.capacity > 0
      ? (flight.assignedBags / flight.capacity) * 100
      : 0

  return (
    <Box sx={{ minWidth: 240 }}>

      <Typography
        sx={{
          fontWeight: 700,
          fontSize: 15,
          color: '#1F3864',
        }}
      >
        {flight.originIata} → {flight.destIata}
      </Typography>

      <Typography
        sx={{
          fontSize: 12,
          color: '#6B7280',
        }}
      >
        {flight.originName} → {flight.destName}
      </Typography>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Typography fontSize={12}>
          Estado
        </Typography>

        <Typography
          fontSize={12}
          fontWeight={700}
        >
          {flight.status}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Typography fontSize={12}>
          Capacidad
        </Typography>

        <Typography
          fontSize={12}
          fontWeight={700}
        >
          {flight.assignedBags}/{flight.capacity}
        </Typography>
      </Box>

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
          {loadPct.toFixed(2)}%
        </Typography>
      </Box>

    </Box>
  )
}