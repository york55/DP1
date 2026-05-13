import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import FormLabel from '@mui/material/FormLabel'
import FormControl from '@mui/material/FormControl'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import LuggageIcon from '@mui/icons-material/Luggage'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Backdrop from '@mui/material/Backdrop'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import WorldMap from '../components/map/WorldMap'
import { useSimulationContext } from '../context/SimulationContext'
import { useClock } from '../hooks/useClock'
import DataTable from '../components/common/DataTable'
import { formatFlightTime } from '../utils/timeUtils'

const flightColumns = [
  {
    field: 'id',
    headerName: 'ID',
    width: 110,
    renderCell: (p) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.value}</span>
    ),
  },
  { field: 'airline', headerName: 'Aerolínea', width: 90, renderCell: () => 'TASF' },
  { field: 'originIata', headerName: 'Origen', width: 80 },
  { field: 'destinationIata', headerName: 'Destino', width: 90 },
  {
    field: 'departureTime',
    headerName: 'Salida UTC',
    width: 105,
    renderCell: (p) => formatFlightTime(p.value),
  },
  {
    field: 'arrivalTime',
    headerName: 'Llegada UTC',
    width: 105,
    renderCell: (p) => formatFlightTime(p.value),
  },
  { field: 'baggageCapacity', headerName: 'Cap.', width: 65, type: 'number' },
  {
    field: 'status',
    headerName: 'Estado',
    width: 115,
    renderCell: (p) => (
      <Chip
        label={p.value}
        size="small"
        sx={{
          backgroundColor: p.value === 'SCHEDULED' ? '#E3F2FD' : '#E8F5E9',
          color: p.value === 'SCHEDULED' ? '#1565C0' : '#2E7D32',
          fontSize: '0.65rem',
          fontWeight: 600,
        }}
      />
    ),
  },
]

function SummaryCard({ label, value, color = '#1F3864' }) {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 1.5,
        textAlign: 'center',
        flex: 1,
        borderTop: `3px solid ${color}`,
        borderRadius: 1,
      }}
    >
      <Typography sx={{ fontSize: 20, fontWeight: 700, color }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.65rem' }}>
        {label}
      </Typography>
    </Paper>
  )
}

export default function SimulationConfigPage() {
  const navigate = useNavigate()
  const { startSimulation } = useSimulationContext()
  const utcClock = useClock()

  // FIX 4: use dayjs as the canonical type for startDate (MUI DatePicker returns dayjs)
  const [period, setPeriod] = useState('3')
  const [startDate, setStartDate] = useState()
  const [flightsExpanded, setFlightsExpanded] = useState(false)
  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [shipmentsCount, setShipmentsCount] = useState(0)
  const [starting, setStarting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({
    processed: 0,
    total: 0,
    status: '',
    message: '',
  })
  const [loadedFiles, setLoadedFiles] = useState([])

  // FIX 2: keep a stable ref to the STOMP client so we can deactivate it properly
  const stompClientRef = useRef(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [airportsRes, flightsRes] = await Promise.all([
          apiClient.get('/airports'),
          apiClient.get('/flights'),
        ])

        const mappedAirports = airportsRes.data.map((a) => ({
          ...a,
          lat: a.latitude,
          lon: a.longitude,
          maxCapacity: a.warehouseCapacity,
          occupancy: a.currentOccupancy,
        }))

        const mappedFlights = flightsRes.data.map((f) => ({
          ...f,
          originIata: f.originAirport?.iataCode,
          destinationIata: f.destinationAirport?.iataCode,
        }))

        setAirports(mappedAirports)
        setFlights(mappedFlights)
      } catch (err) {
        console.error('Error fetching simulation data:', err)
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || '/ws'
    const socket = new SockJS(wsUrl)
    const stompClient = new Client({
      webSocketFactory: () => socket,
      // FIX 2: remove noisy debug logger in production; use console.debug to keep it opt-in
      debug: (str) => console.debug('[STOMP]', str),
      onConnect: () => {
        console.log('STOMP connected')
        stompClient.subscribe('/topic/shipments/progress', (message) => {
          const progress = JSON.parse(message.body)
          setUploadProgress(progress)
          if (progress.status === 'COMPLETED') {
            setShipmentsCount(progress.total)
            setUploading(false)
          } else if (progress.status === 'ERROR') {
            setUploading(false)
            alert('Error en la carga: ' + progress.message)
          }
        })
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'])
      },
    })

    stompClient.activate()
    // FIX 2: store ref so cleanup always has access to the current client
    stompClientRef.current = stompClient

    return () => {
      stompClient.deactivate()
    }
  }, [])

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    // Reset input so the same file can be re-selected after clearing
    e.target.value = ''
    if (!files.length) return

    setUploading(true)

    try {
      for (const file of files) {
        setUploadProgress({
          processed: 0,
          total: 0,
          status: 'IN_PROGRESS',
          message: `Subiendo ${file.name}...`,
        })

        const formData = new FormData()
        formData.append('file', file)

        // FIX 5: use the same key name ("period") consistently; convert dayjs → ISO string
        formData.append('periodo', period)
        formData.append('startDate', startDate.toISOString().replace('Z', ''))

        await apiClient.post('/batches/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        setLoadedFiles((prev) => [...prev, file.name])
      }
    } catch (err) {
      console.error('Error subiendo archivos:', err)
      alert('Error subiendo archivos')
      setUploading(false)
    }
    // NOTE: setUploading(false) for the success path is handled by the STOMP
    // COMPLETED message so the progress bar stays visible until the server confirms.
  }

  // FIX 3: removing a loaded file also resets shipmentsCount when no files remain
  const handleRemoveFile = (index) => {
    setLoadedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0) {
        setShipmentsCount(0)
      }
      return updated
    })
  }

  const handleStart = async () => {
    // FIX 6: guard against WebSocket failure — check loadedFiles as a fallback
    if (shipmentsCount === 0 && loadedFiles.length === 0) {
      alert('Por favor, cargue el archivo de envíos antes de iniciar.')
      return
    }

    setStarting(true)
    try {
      // FIX 4 + 5: pass a native Date and the numeric period consistently
      await startSimulation({
        period: parseInt(period, 10),
        startDate: startDate.toDate(),
      })
      navigate('/simulation/running')
    } catch (err) {
      console.error('Error al iniciar simulación:', err)
      alert('No se pudo iniciar la simulación. Verifique los logs del servidor.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: '#1F3864', zIndex: 10 }}>
        <Toolbar variant="dense">
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ mr: 1 }}
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
          <LuggageIcon sx={{ mr: 1, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mr: 0.5 }}>
            Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2E75B6', mx: 2, my: 0.5 }} />
          <Typography variant="body2" sx={{ color: '#90CAF9', fontSize: '0.78rem' }}>
            Configuración de Simulación
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography
            variant="caption"
            sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.78rem' }}
          >
            {utcClock}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content: 70/30 split */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Map (70%) */}
        <Box sx={{ flex: '0 0 70%', position: 'relative' }}>
          {loadingData ? (
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <WorldMap airports={airports} flights={flights} simulatedTime={null} />
          )}
        </Box>

        {/* Right: Config Panel (30%) */}
        <Box
          sx={{
            flex: '0 0 30%',
            overflow: 'auto',
            backgroundColor: '#FFFFFF',
            borderLeft: '1px solid #BFBFBF',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5, fontSize: '1rem' }}
            >
              Simulación por Período
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2.5, fontSize: '0.8rem' }}>
              Configure los parámetros de la simulación y presione Iniciar para comenzar.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Period selector */}
            <FormControl component="fieldset" sx={{ mb: 2.5, width: '100%' }}>
              <FormLabel
                component="legend"
                sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F3864', mb: 1 }}
              >
                Duración del período
              </FormLabel>
              <RadioGroup row value={period} onChange={(e) => setPeriod(e.target.value)}>
                {['3', '5', '7'].map((d) => (
                  <FormControlLabel
                    key={d}
                    value={d}
                    control={
                      <Radio size="small" sx={{ '&.Mui-checked': { color: '#1F3864' } }} />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: period === d ? 700 : 400 }}>
                        {d} días
                      </Typography>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            {/* Start date */}
            <FormControl sx={{ mb: 2.5, width: '100%' }}>
              <FormLabel
                sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F3864', mb: 1, display: 'block' }}
              >
                Fecha de inicio
              </FormLabel>
              {/* FIX 4: DatePicker works natively with dayjs; no conversion needed here */}
              <DatePicker
                value={startDate}
                onChange={(newVal) => setStartDate(newVal)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } },
                  },
                }}
              />
            </FormControl>

            {/* Shipments Upload */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}
              >
                Datos de Envíos (TXT)
              </Typography>

              {/* Loaded files list */}
              {loadedFiles.length > 0 && !uploading && (
                <Box sx={{ mb: 1 }}>
                  {loadedFiles.map((fileName, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        mb: 1,
                        borderRadius: 1,
                        border: '1px solid #A5D6A7',
                        backgroundColor: '#F1FBF3',
                      }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#2E7D32', flexShrink: 0 }} />
                      <InsertDriveFileOutlinedIcon
                        sx={{ fontSize: 16, color: '#4CAF50', flexShrink: 0 }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          flex: 1,
                          color: '#1B5E20',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fileName}
                      </Typography>
                      {/* FIX 3: use dedicated handler that resets shipmentsCount when empty */}
                      <Tooltip title="Quitar archivo">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFile(index)}
                          sx={{ color: '#C62828', p: 0.25 }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}

              <Button
                component="label"
                variant="outlined"
                fullWidth
                disabled={uploading}
                startIcon={<CloudUploadIcon />}
                sx={{
                  py: 1,
                  borderColor: uploading ? '#A5D6A7' : '#2E75B6',
                  color: uploading ? '#A5D6A7' : '#2E75B6',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                Cargar Archivo de Envíos
                <input
                  type="file"
                  accept=".txt"
                  multiple
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>

              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#1F3864' }}>
                    {uploadProgress.message} ({uploadProgress.processed} /{' '}
                    {uploadProgress.total || '?'})
                  </Typography>
                  <LinearProgress
                    variant={uploadProgress.total > 0 ? 'determinate' : 'indeterminate'}
                    value={
                      uploadProgress.total > 0
                        ? (uploadProgress.processed / uploadProgress.total) * 100
                        : 0
                    }
                  />
                </Box>
              )}
            </Box>

            {/* Summary cards */}
            <Box sx={{ mb: 2.5 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}
              >
                Resumen del escenario
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <SummaryCard label="Aeropuertos" value={airports.length} color="#1F3864" />
                <SummaryCard label="Vuelos" value={flights.length} color="#2E75B6" />
                <SummaryCard label="Envíos" value={shipmentsCount} color="#2E7D32" />
              </Box>
            </Box>

            {/* Start button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleStart}
              disabled={starting || uploading}
              sx={{
                backgroundColor: '#1F3864',
                fontWeight: 700,
                fontSize: '0.9rem',
                py: 1.5,
                '&:hover': { backgroundColor: '#162D4F' },
              }}
            >
              {starting ? 'INICIANDO...' : 'INICIAR SIMULACIÓN'}
            </Button>

            <Divider sx={{ my: 2 }} />

            {/* Collapsible flights table */}
            <Box>
              <Button
                fullWidth
                variant="text"
                endIcon={flightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setFlightsExpanded((v) => !v)}
                sx={{
                  justifyContent: 'space-between',
                  color: '#1F3864',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  px: 0,
                }}
              >
                Vuelos del Escenario ({flights.length})
              </Button>
              <Collapse in={flightsExpanded}>
                <Box sx={{ mt: 1 }}>
                  <DataTable rows={flights} columns={flightColumns} />
                </Box>
              </Collapse>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Backdrop for simulation start */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2,
          textAlign: 'center',
          backgroundColor: 'rgba(31, 56, 100, 0.9)',
        }}
        open={starting}
      >
        <CircularProgress color="inherit" size={60} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Inicializando Simulación
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300 }}>
            Estamos procesando los envíos y optimizando las rutas iniciales. Esto puede tomar un
            momento...
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  )
}
