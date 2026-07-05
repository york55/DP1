import { useState, useEffect, useCallback, useRef } from 'react'
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
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LuggageIcon from '@mui/icons-material/Luggage'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import FlightLandIcon from '@mui/icons-material/FlightLand'
import RefreshIcon from '@mui/icons-material/Refresh'
import InventoryIcon from '@mui/icons-material/Inventory2'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import client from '../../api/client'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#F8FAFF',
    '&:hover fieldset': { borderColor: '#3B6AC7' },
    '&.Mui-focused fieldset': { borderColor: '#1F3864', borderWidth: 2 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#1F3864' },
}

export default function BaggageRegistrationPage({ user }) {
  // El origen ya no se elige: es el aeropuerto del usuario autenticado.
  const origenFijo = user?.airportIata || ''

  // ─── Estado existente ───────────────────────────────────────────────────────
  const [aeropuertos, setAeropuertos]               = useState([])
  const [loadingAeropuertos, setLoadingAeropuertos] = useState(true)
  const [destino, setDestino]                       = useState('')
  const [cantidad, setCantidad]                     = useState('')
  const [cliente, setCliente]                       = useState('')
  const [loading, setLoading]                       = useState(false)
  const [envios, setEnvios]                         = useState([])
  const [loadingEnvios, setLoadingEnvios]           = useState(false)
  const [snack, setSnack]                           = useState({ open: false, msg: '', severity: 'success' })

  // ─── Estado carga masiva ────────────────────────────────────────────────────
  const [modoActivo, setModoActivo]               = useState('manual')   // 'manual' | 'masivo'
  const [archivosParseados, setArchivosParseados] = useState([])         // [{ filename, destino, registros[] }]
  const [dragging, setDragging]                   = useState(false)
  const [procesando, setProcesando]               = useState(false)
  const [progreso, setProgreso]                   = useState(0)
  const [resultadoMasivo, setResultadoMasivo]     = useState(null)       // { exitosos, errores, total }
  const fileInputRef = useRef(null)

  // ─── Efectos existentes ─────────────────────────────────────────────────────
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
      setEnvios(res.data.filter(e => e.status === 'PENDING'))
    } catch {
      setSnack({ open: true, msg: 'Error al cargar envíos', severity: 'error' })
    } finally {
      setLoadingEnvios(false)
    }
  }, [])

  useEffect(() => { fetchEnvios() }, [fetchEnvios])

  const aeropuertoOrigen = aeropuertos.find(a => a.iataCode === origenFijo)

  // ─── Handlers modo manual ───────────────────────────────────────────────────
  const handleCantidad = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCantidad(val)
  }

  const cantidadFormateada = cantidad.padStart(3, '0')

  const handleRegistrar = async () => {
    if (!origenFijo) {
      setSnack({ open: true, msg: 'No se pudo determinar tu almacén de origen. Vuelve a iniciar sesión.', severity: 'error' })
      return
    }
    if (!destino || !cantidad || parseInt(cantidad) < 1) {
      setSnack({ open: true, msg: 'Completa todos los campos correctamente.', severity: 'warning' })
      return
    }
    if (!cliente.trim()) {
      setSnack({ open: true, msg: 'Ingresa el nombre del cliente.', severity: 'warning' })
      return
    }
    if (origenFijo === destino) {
      setSnack({ open: true, msg: 'El almacén origen y destino no pueden ser iguales.', severity: 'warning' })
      return
    }
    setLoading(true)
    try {
      const res = await client.post('/envios/registrar', {
        almacenOrigen:   origenFijo,
        almacenDestino:  destino,
        cantidadMaletas: cantidadFormateada,
        cliente:         cliente.trim(),
      })
      setSnack({ open: true, msg: `Envío registrado: ${res.data.idEnvio}`, severity: 'success' })
      setDestino('')
      setCantidad('')
      setCliente('')
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

  // ─── Lógica carga masiva ────────────────────────────────────────────────────
  // Nota: el origen de la carga masiva también queda fijado al almacén del
  // usuario autenticado; el código de aeropuerto en el nombre del archivo ya
  // no se usa para determinar el origen, solo como referencia informativa.

  /**
   * Parsea el contenido de un archivo .txt línea a línea.
   * Formato de línea: 000000001-20260618-15-59-LOWW-002-0000500
   *   [0] id (ignorado)  [1] fecha  [2] hora  [3] min
   *   [4] iata destino   [5] cantidad maletas  [6] otro campo
   * El origen es siempre el almacén del usuario autenticado.
   */
  const parsearArchivoTxt = (nombre, contenido) => {
    const lineas = contenido.split('\n').filter(l => l.trim())
    const registros = lineas.map((linea, idx) => {
      const partes = linea.trim().split('-')
      if (partes.length < 6) return null
      return {
        _key:     `${nombre}-${idx}`,
        origen:   origenFijo,  // siempre el del usuario logueado
        destino:  partes[4],
        cantidad: partes[5],
      }
    }).filter(Boolean)

    return { filename: nombre, origen: origenFijo, registros }
  }

  const cargarArchivos = useCallback((files) => {
    const txtFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.txt'))
    if (txtFiles.length === 0) {
      setSnack({ open: true, msg: 'Solo se aceptan archivos .txt', severity: 'warning' })
      return
    }
    txtFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const parsed = parsearArchivoTxt(file.name, e.target.result)
        if (!parsed) {
          setSnack({
            open: true,
            msg: `No se pudo leer el archivo "${file.name}".`,
            severity: 'warning',
          })
          return
        }
        if (parsed.registros.length === 0) {
          setSnack({ open: true, msg: `"${file.name}" no contiene registros válidos.`, severity: 'warning' })
          return
        }
        setArchivosParseados(prev =>
          prev.find(a => a.filename === file.name) ? prev : [...prev, parsed]
        )

      }
      reader.readAsText(file)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenFijo])

  const eliminarArchivo = (filename) =>
    setArchivosParseados(prev => prev.filter(a => a.filename !== filename))

  const limpiarMasivo = () => {
    setArchivosParseados([])
    setResultadoMasivo(null)
    setProgreso(0)
  }

  /**
   * Procesa los registros secuencialmente reutilizando el mismo endpoint
   * de registro manual. El backend asigna el ID siguiente; el ID del archivo
   * es ignorado. El cliente para la carga masiva se toma del campo
   * "Cliente" del formulario (aplica a todos los registros del lote).
   */
  const procesarMasivo = async () => {
    const todos = archivosParseados.flatMap(a => a.registros)
    if (todos.length === 0) return

    if (!cliente.trim()) {
      setSnack({ open: true, msg: 'Ingresa el cliente que aplica a este lote antes de procesar.', severity: 'warning' })
      return
    }

    setProcesando(true)
    setProgreso(0)
    setResultadoMasivo(null)

    let exitosos = 0
    let errores  = 0

    for (let i = 0; i < todos.length; i++) {
      const r = todos[i]
      try {
        await client.post('/envios/registrar', {
          almacenOrigen:   r.origen,
          almacenDestino:  r.destino,
          cantidadMaletas: r.cantidad,
          cliente:         cliente.trim(),
        })
        exitosos++
      } catch {
        errores++
      }
      setProgreso(Math.round(((i + 1) / todos.length) * 100))
    }

    setResultadoMasivo({ exitosos, errores, total: todos.length })
    setProcesando(false)
    setArchivosParseados([])
    fetchEnvios()
  }

  // ─── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop      = (e) => {
    e.preventDefault()
    setDragging(false)
    if (!procesando) cargarArchivos(e.dataTransfer.files)
  }

  // ─── Helpers de render ──────────────────────────────────────────────────────
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

  const totalRegistros = archivosParseados.flatMap(a => a.registros).length

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1280, mx: 'auto' }}>

      {/* Encabezado */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <LuggageIcon sx={{ fontSize: 36, color: '#1F3864' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864', letterSpacing: '-0.5px' }}>
          Registro de Maletas
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start' }}>

        {/* ── Columna izquierda — Formulario / Carga masiva ──────────────────── */}
        <Box sx={{
          width: { xs: '100%', md: 420 },
          flexShrink: 0,
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(31,56,100,0.10)',
          border: '1px solid #E5EAF2',
          p: { xs: 3, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          position: { md: 'sticky' },
          top: { md: 24 },
        }}>

          {/* Origen fijo (almacén del usuario autenticado) */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            p: 1.5, borderRadius: '10px',
            backgroundColor: '#F0F4FB', border: '1px solid #DCE4F2',
          }}>
            <LockIcon sx={{ color: '#6B7280', fontSize: 18 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600, letterSpacing: '0.03em' }}>
                ALMACÉN ORIGEN (FIJO)
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F3864' }}>
                {origenFijo || '—'}{aeropuertoOrigen ? ` · ${aeropuertoOrigen.name}, ${aeropuertoOrigen.country}` : ''}
              </Typography>
            </Box>
          </Box>

          {/* Toggle de modo */}
          <Box sx={{
            display: 'flex',
            backgroundColor: '#F0F4FB',
            borderRadius: '10px',
            p: '4px',
            gap: '4px',
          }}>
            {[
              { key: 'manual', label: 'Manual',        icon: <EditIcon sx={{ fontSize: 16 }} /> },
              { key: 'masivo', label: 'Carga masiva',  icon: <CloudUploadIcon sx={{ fontSize: 16 }} /> },
            ].map(({ key, label, icon }) => (
              <Button
                key={key}
                onClick={() => { setModoActivo(key); setResultadoMasivo(null) }}
                startIcon={icon}
                sx={{
                  flex: 1,
                  py: '6px',
                  borderRadius: '7px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  color: modoActivo === key ? '#1F3864' : '#6B7280',
                  backgroundColor: modoActivo === key ? '#fff' : 'transparent',
                  boxShadow: modoActivo === key ? '0 1px 4px rgba(31,56,100,0.15)' : 'none',
                  '&:hover': {
                    backgroundColor: modoActivo === key ? '#fff' : 'rgba(31,56,100,0.06)',
                  },
                  transition: 'all 0.2s',
                  minWidth: 0,
                }}
              >
                {label}
              </Button>
            ))}
          </Box>

          {/* Cliente (aplica a ambos modos) */}
          <TextField
            label="Cliente"
            value={cliente}
            onChange={e => setCliente(e.target.value.slice(0, 100))}
            fullWidth
            sx={inputSx}
            placeholder="Nombre del cliente"
            InputProps={{ startAdornment: <PersonIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} /> }}
            helperText={modoActivo === 'masivo' ? 'Se aplicará a todos los registros del lote' : undefined}
          />

          {/* ════════════════ MODO MANUAL ════════════════ */}
          {modoActivo === 'manual' && (
            <>
              {loadingAeropuertos ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#1F3864' }} />
                </Box>
              ) : (
                <>
                  <FormControl fullWidth sx={inputSx}>
                    <InputLabel>Almacén Destino</InputLabel>
                    <Select
                      value={destino}
                      label="Almacén Destino"
                      onChange={e => setDestino(e.target.value)}
                      startAdornment={<FlightLandIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} />}
                    >
                      {aeropuertos.map(a => renderMenuItem(a, origenFijo))}
                    </Select>
                  </FormControl>

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
                        minWidth: 72,
                        height: 56,
                        border: '2px solid #1F3864',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#F0F4FB',
                      }}>
                        <Typography sx={{ fontWeight: 700, color: '#1F3864', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                          {cantidadFormateada}
                        </Typography>
                      </Box>
                    )}
                  </Box>

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
                      py: 1.5,
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(31,56,100,0.25)',
                      '&:hover': { backgroundColor: '#162b4d' },
                      '&:disabled': { backgroundColor: '#9CA3AF' },
                    }}
                    startIcon={loading
                      ? <CircularProgress size={20} sx={{ color: '#fff' }} />
                      : <LuggageIcon />
                    }
                  >
                    {loading ? 'Registrando...' : 'Registrar Envío'}
                  </Button>
                </>
              )}
            </>
          )}

          {/* ════════════════ MODO MASIVO ════════════════ */}
          {modoActivo === 'masivo' && (
            <>
              {/* Zona drag & drop */}
              <Box
                onClick={() => !procesando && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                  border: `2px dashed ${dragging ? '#1F3864' : '#CBD5E1'}`,
                  borderRadius: '12px',
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: procesando ? 'not-allowed' : 'pointer',
                  backgroundColor: dragging ? '#EEF2FB' : '#F8FAFF',
                  transition: 'border-color 0.2s, background-color 0.2s',
                  '&:hover': !procesando
                    ? { borderColor: '#3B6AC7', backgroundColor: '#EEF2FB' }
                    : {},
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 36, color: dragging ? '#1F3864' : '#9CA3AF', transition: 'color 0.2s' }} />
                <Typography sx={{ fontWeight: 600, color: '#1F3864', fontSize: '0.9rem' }}>
                  Arrastra archivos .txt aquí
                </Typography>
                <Typography sx={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
                  o haz clic para seleccionar
                </Typography>
                <Chip
                  label={`Origen: ${origenFijo || '—'}`}
                  size="small"
                  sx={{
                    mt: 0.5,
                    backgroundColor: '#E8EEF7',
                    color: '#6B7280',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>

              {/* Input oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { cargarArchivos(e.target.files); e.target.value = '' }}
              />

              {/* Lista de archivos cargados */}
              {archivosParseados.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {archivosParseados.map(archivo => (
                    <Box
                      key={archivo.filename}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        backgroundColor: '#F8FAFF',
                        border: '1px solid #E5EAF2',
                        borderLeft: '3px solid #3B6AC7',
                        borderRadius: '10px',
                      }}
                    >
                      <InsertDriveFileIcon sx={{ color: '#3B6AC7', fontSize: 20, flexShrink: 0 }} />

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#1F3864',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {archivo.filename}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>
                          {archivo.registros.length} envío{archivo.registros.length !== 1 ? 's' : ''} · origen:{' '}
                          <strong style={{ color: '#1F3864' }}>{archivo.origen}</strong>
                        </Typography>
                      </Box>

                      <Chip
                        label={archivo.registros.length}
                        size="small"
                        sx={{
                          backgroundColor: '#E8EEF7',
                          color: '#1F3864',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          minWidth: 32,
                        }}
                      />

                      <Tooltip title="Quitar archivo">
                        <IconButton
                          size="small"
                          disabled={procesando}
                          onClick={() => eliminarArchivo(archivo.filename)}
                          sx={{
                            color: '#9CA3AF',
                            '&:hover': { color: '#EF4444', backgroundColor: '#FEF2F2' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Totales + botón de procesar / barra de progreso */}
              {archivosParseados.length > 0 && !resultadoMasivo && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>
                      Total:{' '}
                      <strong style={{ color: '#1F3864' }}>{totalRegistros}</strong>{' '}
                      registro{totalRegistros !== 1 ? 's' : ''}
                    </Typography>
                    {!procesando && (
                      <Button
                        size="small"
                        onClick={limpiarMasivo}
                        sx={{ textTransform: 'none', color: '#9CA3AF', fontSize: '0.75rem', minWidth: 0 }}
                      >
                        Limpiar
                      </Button>
                    )}
                  </Box>

                  {procesando ? (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                          Registrando envíos...
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1F3864' }}>
                          {progreso}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progreso}
                        sx={{
                          borderRadius: 4,
                          height: 8,
                          backgroundColor: '#E5EAF2',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: '#1F3864',
                            borderRadius: 4,
                          },
                        }}
                      />
                    </Box>
                  ) : (
                    <Button
                      variant="contained"
                      size="large"
                      onClick={procesarMasivo}
                      sx={{
                        backgroundColor: '#1F3864',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '1rem',
                        py: 1.5,
                        textTransform: 'none',
                        boxShadow: '0 4px 14px rgba(31,56,100,0.25)',
                        '&:hover': { backgroundColor: '#162b4d' },
                      }}
                      startIcon={<CloudUploadIcon />}
                    >
                      Procesar {totalRegistros} envío{totalRegistros !== 1 ? 's' : ''}
                    </Button>
                  )}
                </>
              )}

              {/* Resultado de la carga */}
              {resultadoMasivo && (
                <Box sx={{
                  borderRadius: '12px',
                  p: 2.5,
                  backgroundColor: resultadoMasivo.errores === 0 ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${resultadoMasivo.errores === 0 ? '#BBF7D0' : '#FDE68A'}`,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                      Carga completada
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#16A34A', lineHeight: 1 }}>
                        {resultadoMasivo.exitosos}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mt: 0.5 }}>
                        exitosos
                      </Typography>
                    </Box>

                    {resultadoMasivo.errores > 0 && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#DC2626', lineHeight: 1 }}>
                          {resultadoMasivo.errores}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mt: 0.5 }}>
                          con error
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#94A3B8', lineHeight: 1 }}>
                        {resultadoMasivo.total}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mt: 0.5 }}>
                        total
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    size="small"
                    onClick={limpiarMasivo}
                    sx={{
                      mt: 2,
                      textTransform: 'none',
                      color: '#3B6AC7',
                      fontSize: '0.78rem',
                      p: 0,
                      fontWeight: 600,
                    }}
                  >
                    ← Subir más archivos
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* ── Columna derecha — Pendientes (sin cambios) ─────────────────────── */}
        <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ color: '#1F3864', fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>
                Por enviar
              </Typography>
              <Chip
                label={envios.length}
                size="small"
                sx={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Box>
            <Tooltip title="Actualizar">
              <IconButton onClick={fetchEnvios} disabled={loadingEnvios}>
                {loadingEnvios
                  ? <CircularProgress size={20} />
                  : <RefreshIcon sx={{ color: '#1F3864' }} />}
              </IconButton>
            </Tooltip>
          </Box>

          {loadingEnvios && envios.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#1F3864' }} />
            </Box>
          ) : envios.length === 0 ? (
            <Box sx={{
              textAlign: 'center',
              py: 6,
              color: '#9CA3AF',
              border: '1px dashed #D1D5DB',
              borderRadius: '12px',
            }}>
              <InventoryIcon sx={{ fontSize: 36, mb: 1, color: '#D1D5DB' }} />
              <Typography variant="body2">No hay envíos pendientes.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {envios.map(e => (
                <Box
                  key={e.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: '#fff',
                    border: '1px solid #E5EAF2',
                    borderLeft: '4px solid #F59E0B',
                    borderRadius: '12px',
                    p: 2,
                    transition: 'box-shadow 0.15s',
                    '&:hover': { boxShadow: '0 2px 12px rgba(31,56,100,0.08)' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9CA3AF', mb: 0.5 }}>
                      {e.externalId}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={e.originIata}
                        size="small"
                        sx={{ backgroundColor: '#E8EEF7', color: '#1F3864', fontWeight: 700, fontSize: '0.72rem' }}
                      />
                      <Typography sx={{ color: '#9CA3AF', fontSize: '0.8rem' }}>→</Typography>
                      <Chip
                        label={e.destIata}
                        size="small"
                        sx={{ backgroundColor: '#E8EEF7', color: '#1F3864', fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </Box>
                    {e.clientCode && (
                      <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', mt: 0.5 }}>
                        Cliente: <strong style={{ color: '#1F3864' }}>{e.clientCode}</strong>
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ textAlign: 'center', minWidth: 64 }}>
                    <Typography sx={{ fontWeight: 700, color: '#1F3864', fontSize: '1.1rem' }}>
                      {e.bagCount}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>maletas</Typography>
                  </Box>

                  <Box sx={{ textAlign: 'right', minWidth: 110 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}>
                      {e.registeredAt
                        ? new Date(e.registeredAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 600 }}>
                      vence {e.deadlineUtc
                        ? new Date(e.deadlineUtc).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
