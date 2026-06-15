import { useState, useEffect, useCallback } from 'react'
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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LuggageIcon from '@mui/icons-material/Luggage'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import FlightLandIcon from '@mui/icons-material/FlightLand'
import RefreshIcon from '@mui/icons-material/Refresh'
import client from '../../api/client'

const STATUS_COLORS = {
  PENDING:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
  PLANNED:    { bg: '#DBEAFE', color: '#1E40AF', label: 'Planificado' },
  IN_TRANSIT: { bg: '#D1FAE5', color: '#065F46', label: 'En tránsito' },
  DELIVERED:  { bg: '#E0E7FF', color: '#3730A3', label: 'Entregado' },
  DELAYED:    { bg: '#FEE2E2', color: '#991B1B', label: 'Retrasado' },
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

export default function BaggageRegistrationPage() {
  const [aeropuertos, setAeropuertos]           = useState([])
  const [loadingAeropuertos, setLoadingAeropuertos] = useState(true)
  const [origen, setOrigen]                     = useState('')
  const [destino, setDestino]                   = useState('')
  const [cantidad, setCantidad]                 = useState('')
  const [loading, setLoading]                   = useState(false)
  const [envios, setEnvios]                     = useState([])
  const [loadingEnvios, setLoadingEnvios]       = useState(false)
  const [snack, setSnack]                       = useState({ open: false, msg: '', severity: 'success' })

  useEffect(() => {
    client.get('/ops/airports')
      .then(res => setAeropuertos(res.data))
      .catch(() => setSnack({ open: true, msg: 'Error al cargar aeropuertos', severity: 'error' }))
      .finally(() => setLoadingAeropuertos(false))
  }, [])

  const fetchEnvios = useCallback(async () => {
    setLoadingEnvios(true)
    try {
      const res = await client.get('/envios')
      setEnvios(res.data)
    } catch {
      setSnack({ open: true, msg: 'Error al cargar envíos', severity: 'error' })
    } finally {
      setLoadingEnvios(false)
    }
  }, [])

  useEffect(() => { fetchEnvios() }, [fetchEnvios])

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
      const res = await client.post('/envios/registrar', {
        almacenOrigen:   origen,
        almacenDestino:  destino,
        cantidadMaletas: cantidadFormateada,
      })
      setSnack({ open: true, msg: `Envío registrado: ${res.data.idEnvio}`, severity: 'success' })
      setOrigen('')
      setDestino('')
      setCantidad('')
      fetchEnvios()
    } catch (err) {
      const msg = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message || 'Error al registrar el envío'
      setSnack({ open: true, msg, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const renderMenuItem = (a, disabledCode) => (
    <MenuItem key={a.iataCode} value={a.iataCode} disabled={a.iataCode === disabledCode}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3864' }}>{a.iataCode}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>{a.name}, {a.country}</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#9CA3AF', ml: 2 }}>
          GMT{a.gmtOffset >= 0 ? `+${a.gmtOffset}` : a.gmtOffset}
        </Typography>
      </Box>
    </MenuItem>
  )

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1000, mx: 'auto' }}>

      {/* Título */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <LuggageIcon sx={{ fontSize: 36, color: '#1F3864' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864', letterSpacing: '-0.5px' }}>
          Registro de Maletas
        </Typography>
      </Box>

      {/* Formulario */}
      <Box sx={{
        width: '100%', maxWidth: 520,
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(31,56,100,0.10)',
        border: '1px solid #E5EAF2',
        p: { xs: 3, sm: 4 },
        display: 'flex', flexDirection: 'column', gap: 3,
        mb: 5,
      }}>
        {loadingAeropuertos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#1F3864' }} />
          </Box>
        ) : (
          <>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Almacén Origen</InputLabel>
              <Select value={origen} label="Almacén Origen" onChange={e => setOrigen(e.target.value)}
                startAdornment={<FlightTakeoffIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} />}>
                {aeropuertos.map(a => renderMenuItem(a, destino))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Almacén Destino</InputLabel>
              <Select value={destino} label="Almacén Destino" onChange={e => setDestino(e.target.value)}
                startAdornment={<FlightLandIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} />}>
                {aeropuertos.map(a => renderMenuItem(a, origen))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Cantidad de Maletas" value={cantidad} onChange={handleCantidad}
                inputProps={{ inputMode: 'numeric', maxLength: 3 }}
                placeholder="001" fullWidth sx={inputSx}
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

            <Button
              variant="contained" size="large" onClick={handleRegistrar} disabled={loading}
              sx={{
                mt: 1, backgroundColor: '#1F3864', borderRadius: '10px',
                fontWeight: 700, fontSize: '1rem', py: 1.5, textTransform: 'none',
                boxShadow: '0 4px 14px rgba(31,56,100,0.25)',
                '&:hover': { backgroundColor: '#162b4d' },
                '&:disabled': { backgroundColor: '#9CA3AF' },
              }}
              startIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <LuggageIcon />}
            >
              {loading ? 'Registrando...' : 'Registrar Envío'}
            </Button>
          </>
        )}
      </Box>

      {/* Tabla de envíos */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>
            Envíos Registrados
          </Typography>
          <Tooltip title="Actualizar">
            <IconButton onClick={fetchEnvios} disabled={loadingEnvios}>
              {loadingEnvios
                ? <CircularProgress size={20} />
                : <RefreshIcon sx={{ color: '#1F3864' }} />}
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer sx={{ borderRadius: '12px', border: '1px solid #E5EAF2', backgroundColor: '#fff' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F0F4FB' }}>
                {['ID Externo', 'Origen', 'Destino', 'Maletas', 'Estado', 'Registrado', 'Deadline'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: '#1F3864', fontSize: '0.78rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {envios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>
                    No hay envíos registrados aún.
                  </TableCell>
                </TableRow>
              ) : envios.map(e => {
                const st = STATUS_COLORS[e.status] || { bg: '#F3F4F6', color: '#374151', label: e.status }
                return (
                  <TableRow key={e.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>
                      {e.externalId}
                    </TableCell>
                    <TableCell>
                      <Chip label={e.originIata} size="small"
                        sx={{ backgroundColor: '#E8EEF7', color: '#1F3864', fontWeight: 700, fontSize: '0.75rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={e.destIata} size="small"
                        sx={{ backgroundColor: '#E8EEF7', color: '#1F3864', fontWeight: 700, fontSize: '0.75rem' }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>{e.bagCount}</TableCell>
                    <TableCell>
                      <Chip label={st.label} size="small"
                        sx={{ backgroundColor: st.bg, color: st.color, fontWeight: 600, fontSize: '0.72rem' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                      {e.registeredAt ? new Date(e.registeredAt).toLocaleString('es-PE') : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                      {e.deadlineUtc ? new Date(e.deadlineUtc).toLocaleString('es-PE') : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Snackbar
        open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}