import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import LuggageIcon from '@mui/icons-material/Luggage'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import FlightLandIcon from '@mui/icons-material/FlightLand'

const ALMACENES = [
  { codigo: 'SKBO', ciudad: 'Bogota',            pais: 'Colombia',       gmt: -5 },
  { codigo: 'SEQM', ciudad: 'Quito',             pais: 'Ecuador',        gmt: -5 },
  { codigo: 'SVMI', ciudad: 'Caracas',           pais: 'Venezuela',      gmt: -4 },
  { codigo: 'SBBR', ciudad: 'Brasilia',          pais: 'Brasil',         gmt: -3 },
  { codigo: 'SPIM', ciudad: 'Lima',              pais: 'Perú',           gmt: -5 },
  { codigo: 'SLLP', ciudad: 'La Paz',            pais: 'Bolivia',        gmt: -4 },
  { codigo: 'SCEL', ciudad: 'Santiago de Chile', pais: 'Chile',          gmt: -3 },
  { codigo: 'SABE', ciudad: 'Buenos Aires',      pais: 'Argentina',      gmt: -3 },
  { codigo: 'SGAS', ciudad: 'Asunción',          pais: 'Paraguay',       gmt: -4 },
  { codigo: 'SUAA', ciudad: 'Montevideo',        pais: 'Uruguay',        gmt: -3 },
  { codigo: 'LATI', ciudad: 'Tirana',            pais: 'Albania',        gmt: +2 },
  { codigo: 'EDDI', ciudad: 'Berlin',            pais: 'Alemania',       gmt: +2 },
  { codigo: 'LOWW', ciudad: 'Viena',             pais: 'Austria',        gmt: +2 },
  { codigo: 'EBCI', ciudad: 'Bruselas',          pais: 'Belgica',        gmt: +2 },
  { codigo: 'UMMS', ciudad: 'Minsk',             pais: 'Bielorrusia',    gmt: +3 },
  { codigo: 'LBSF', ciudad: 'Sofia',             pais: 'Bulgaria',       gmt: +3 },
  { codigo: 'LKPR', ciudad: 'Praga',             pais: 'Checa',          gmt: +2 },
  { codigo: 'LDZA', ciudad: 'Zagreb',            pais: 'Croacia',        gmt: +2 },
  { codigo: 'EKCH', ciudad: 'Copenhague',        pais: 'Dinamarca',      gmt: +2 },
  { codigo: 'EHAM', ciudad: 'Amsterdam',         pais: 'Holanda',        gmt: +2 },
  { codigo: 'VIDP', ciudad: 'Delhi',             pais: 'India',          gmt: +5 },
  { codigo: 'OSDI', ciudad: 'Damasco',           pais: 'Siria',          gmt: +3 },
  { codigo: 'OERK', ciudad: 'Riad',              pais: 'Arabia Saudita', gmt: +3 },
  { codigo: 'OMDB', ciudad: 'Dubai',             pais: 'Emiratos A.U',   gmt: +4 },
  { codigo: 'OAKB', ciudad: 'Kabul',             pais: 'Afganistan',     gmt: +4 },
  { codigo: 'OOMS', ciudad: 'Mascate',           pais: 'Oman',           gmt: +4 },
  { codigo: 'OYSN', ciudad: 'Sana',              pais: 'Yemen',          gmt: +3 },
  { codigo: 'OPKC', ciudad: 'Karachi',           pais: 'Pakistan',       gmt: +5 },
  { codigo: 'UBBB', ciudad: 'Baku',              pais: 'Azerbaiyan',     gmt: +2 },
  { codigo: 'OJAI', ciudad: 'Aman',              pais: 'Jordania',       gmt: +3 },
]

const API_BASE = 'http://localhost:8080/api/envios'

export default function BaggageRegistrationPage() {
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [loading, setLoading] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' })

  const handleCantidad = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCantidad(val)
  }

  const cantidadFormateada = cantidad.padStart(3, '0')

  const handleRegistrar = async () => {
    if (!origen || !destino || !cantidad || parseInt(cantidad) < 1) {
      setSnack({ open: true, msg: 'Completa todos los campos correctamente.', severity: 'warning' })
      return
    }
    if (origen === destino) {
      setSnack({ open: true, msg: 'El almacén origen y destino no pueden ser iguales.', severity: 'warning' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          almacenOrigen: origen,
          almacenDestino: destino,
          cantidadMaletas: cantidadFormateada,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Error al registrar')
      }

      const data = await response.json()
      setSnack({ open: true, msg: `Envío registrado: ${data.idEnvio}`, severity: 'success' })
      setOrigen('')
      setDestino('')
      setCantidad('')
    } catch (err) {
      setSnack({ open: true, msg: err.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      backgroundColor: '#F8FAFF',
      '&:hover fieldset': { borderColor: '#3B6AC7' },
      '&.Mui-focused fieldset': { borderColor: '#1F3864', borderWidth: 2 },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#1F3864' },
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <LuggageIcon sx={{ fontSize: 36, color: '#1F3864' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864', letterSpacing: '-0.5px' }}>
          Registro de Maletas
        </Typography>
      </Box>

      {/* Card */}
      <Box sx={{
        width: '100%', maxWidth: 520,
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(31,56,100,0.10)',
        border: '1px solid #E5EAF2',
        p: { xs: 3, sm: 4 },
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>

        {/* Almacén Origen */}
        <FormControl fullWidth sx={inputSx}>
          <InputLabel>Almacén Origen</InputLabel>
          <Select
            value={origen}
            label="Almacén Origen"
            onChange={(e) => setOrigen(e.target.value)}
            startAdornment={<FlightTakeoffIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} />}
          >
            {ALMACENES.map((a) => (
              <MenuItem key={a.codigo} value={a.codigo} disabled={a.codigo === destino}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3864' }}>{a.codigo}</Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>{a.ciudad}, {a.pais}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', ml: 2 }}>
                    GMT{a.gmt >= 0 ? `+${a.gmt}` : a.gmt}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Almacén Destino */}
        <FormControl fullWidth sx={inputSx}>
          <InputLabel>Almacén Destino</InputLabel>
          <Select
            value={destino}
            label="Almacén Destino"
            onChange={(e) => setDestino(e.target.value)}
            startAdornment={<FlightLandIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} />}
          >
            {ALMACENES.map((a) => (
              <MenuItem key={a.codigo} value={a.codigo} disabled={a.codigo === origen}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3864' }}>{a.codigo}</Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>{a.ciudad}, {a.pais}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', ml: 2 }}>
                    GMT{a.gmt >= 0 ? `+${a.gmt}` : a.gmt}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Cantidad de maletas */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Cantidad de Maletas"
            value={cantidad}
            onChange={handleCantidad}
            inputProps={{ inputMode: 'numeric', maxLength: 3 }}
            placeholder="001"
            fullWidth
            sx={inputSx}
            helperText="Entre 1 y 999 maletas"
          />
          {cantidad && (
            <Box sx={{
              minWidth: 72, height: 56,
              border: '2px solid #1F3864', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#F0F4FB',
            }}>
              <Typography sx={{ fontWeight: 700, color: '#1F3864', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                {cantidadFormateada}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Botón */}
        <Button
          variant="contained"
          size="large"
          onClick={handleRegistrar}
          disabled={loading}
          sx={{
            mt: 1,
            backgroundColor: '#1F3864',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '0.3px',
            py: 1.5,
            textTransform: 'none',
            boxShadow: '0 4px 14px rgba(31,56,100,0.25)',
            '&:hover': { backgroundColor: '#162b4d', boxShadow: '0 6px 20px rgba(31,56,100,0.35)' },
            '&:disabled': { backgroundColor: '#9CA3AF' },
          }}
          startIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <LuggageIcon />}
        >
          {loading ? 'Registrando...' : 'Registrar Envío'}
        </Button>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}