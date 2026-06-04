import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LuggageIcon from '@mui/icons-material/Luggage'

export default function BaggageRegistrationPage() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <LuggageIcon sx={{ fontSize: 64, color: '#BFBFBF' }} />
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864' }}>Registro de Maletas</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280' }}>Módulo en construcción</Typography>
    </Box>
  )
}