import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { clpSimulationApi } from '../api/clpSimulationApi'
import { useClpSimulationContext } from '../context/ClpSimulationContext'
import { useClock } from '../hooks/useClock'
import WorldMap from '../components/map/WorldMap'
import DataTable from '../components/common/DataTable'
import { formatFlightTime } from '../utils/timeUtils'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import FormLabel from '@mui/material/FormLabel'
import FormControl from '@mui/material/FormControl'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import LuggageIcon from '@mui/icons-material/Luggage'
import WarningIcon from '@mui/icons-material/Warning'
import InventoryIcon from '@mui/icons-material/Inventory'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Backdrop from '@mui/material/Backdrop'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'

const flightColumns = [
  {
    field: 'id', headerName: 'ID', width: 110,
    renderCell: (p) => <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.value}</span>,
  },
  { field: 'airlineName', headerName: 'Aerolínea', width: 90, renderCell: (p) => p.row.airlineName || p.row.airlineIata || '—' },
  { field: 'originIata', headerName: 'Origen', width: 80 },
  { field: 'destinationIata', headerName: 'Destino', width: 90 },
  { field: 'departureTime', headerName: 'Salida UTC', width: 105, renderCell: (p) => formatFlightTime(p.value) },
  { field: 'arrivalTime', headerName: 'Llegada UTC', width: 105, renderCell: (p) => formatFlightTime(p.value) },
  { field: 'baggageCapacity', headerName: 'Cap.', width: 65, type: 'number' },
  {
    field: 'status', headerName: 'Estado', width: 115,
    renderCell: (p) => (
      <Chip label={p.value} size="small"
        sx={{
          backgroundColor: p.value === 'SCHEDULED' ? '#E3F2FD' : '#E8F5E9',
          color: p.value === 'SCHEDULED' ? '#1565C0' : '#2E7D32',
          fontSize: '0.65rem', fontWeight: 600,
        }}
      />
    ),
  },
]

const ACCENT = '#B71C1C'
const ACCENT_HOVER = '#7F0000'

export default function ClpSimulationConfigPage() {
  const navigate = useNavigate()
  const { startClpSimulation, resetSimulation } = useClpSimulationContext()
  const utcClock = useClock()

  useEffect(() => { resetSimulation() }, [])

  const [startDate, setStartDate] = useState()
  const [flightsExpanded, setFlightsExpanded] = useState(false)
  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [starting, setStarting] = useState(false)
  const [creatingBatches, setCreatingBatches] = useState(false)
  const [isWaitingToStart, setIsWaitingToStart] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [batchProgressMap, setBatchProgressMap] = useState({})

  const [panelWidth, setPanelWidth] = useState(30)
  const isResizing = useRef(false)
  const containerRef = useRef(null)
  const stompClientRef = useRef(null)

  const handleResizeStart = (e) => {
    e.preventDefault()
    isResizing.current = true
    const onMouseMove = (moveEvent) => {
      if (!isResizing.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const offsetFromRight = containerRect.right - moveEvent.clientX
      const newWidthPct = (offsetFromRight / containerRect.width) * 100
      setPanelWidth(Math.min(60, Math.max(20, newWidthPct)))
    }
    const onMouseUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [airportsRes, flightsRes, uploadsRes] = await Promise.all([
          apiClient.get('/airports'),
          apiClient.get('/flights'),
          apiClient.get('/sim/uploads/archivos'),
        ])
        setAirports(airportsRes.data.map((a) => ({
          ...a, lat: a.latitude, lon: a.longitude,
          iata: a.iata || a.iataCode,
          maxCapacity: a.warehouseCapacity, occupancy: a.currentOccupancy,
        })))
        setFlights(flightsRes.data.filter(f => f.frequency === 'DAILY' || !f.frequency))
        setUploadedFiles(uploadsRes.data)
      } catch (err) {
        console.error('Error fetching simulation data:', err)
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [])

  // WebSocket for batch progress (reuses same channel as 5D)
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || '/ws'
    const socket = new SockJS(wsUrl)
    const stompClient = new Client({
      webSocketFactory: () => socket,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe('/topic/shipments/progress', (message) => {
          const data = JSON.parse(message.body)
          if (data.status === 'ALL_COMPLETED') {
            setCreatingBatches(false)
            setIsWaitingToStart(true)
            return
          }
          if (data.status === 'ERROR') {
            alert(`Error procesando envíos: ${data.message}`)
            setCreatingBatches(false)
            return
          }
          setBatchProgressMap((prev) => ({ ...prev, [data.aeropuerto]: data }))
        })
      },
    })
    stompClient.activate()
    stompClientRef.current = stompClient
    return () => stompClient.deactivate()
  }, [])

  // When batches are ready, create + start the Clp simulation
  useEffect(() => {
    if (!isWaitingToStart) return
    const run = async () => {
      try {
        setStarting(true)

        // startClpSimulation ya se encarga de crear la simulación, cargar
        // aeropuertos/vuelos, conectar el WebSocket y arrancarla (POST /start).
        await startClpSimulation({
          startDate: startDate,
          algorithm: 'ALNS',
          cancellationRate: 10.0,
          seed: 42,
          volumePerDay: 10,
        })

        navigate('/clp/running')
      } catch (err) {
        console.error('Error al arrancar simulación de colapso:', err)
        setIsWaitingToStart(false)
        setStarting(false)
      }
    }
    run()
  }, [isWaitingToStart])

  const handleStart = async () => {
    if (!startDate) {
      alert('Por favor, seleccione la fecha de inicio.')
      return
    }
    if (!uploadedFiles.length) {
      alert('No hay archivos de envíos subidos. Ve a Gestión de Envíos y sube los archivos primero.')
      return
    }

    setBatchProgressMap({})
    setCreatingBatches(true)
    setIsWaitingToStart(false)

    try {
      // Reset Clp tables
      await clpSimulationApi.resetDb()

      let dateStr = ''
      if (startDate && startDate.format) {
        dateStr = startDate.format('YYYY-MM-DDTHH:mm:ss')
      } else if (startDate instanceof Date) {
        const pad = (n) => String(n).padStart(2, '0')
        dateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:${pad(startDate.getSeconds())}`
      } else {
        dateStr = String(startDate)
      }

      // Trigger batch creation from existing envío files
      // The Clp orchestrator reads from EnvioStore, so we just need envíos loaded.
      // Signal ready immediately — the orchestrator handles periodic reading.
      setCreatingBatches(false)
      setIsWaitingToStart(true)
    } catch (err) {
      console.error('Error iniciando:', err)
      const detail = err.response?.data?.error || err.response?.data?.mensaje || err.message
      alert(`Error:\n${detail}`)
      setCreatingBatches(false)
    }
  }

  const batchProgressEntries = Object.entries(batchProgressMap)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: ACCENT, zIndex: 10 }}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 1 }} size="small">
            <ArrowBackIcon />
          </IconButton>
          <WarningIcon sx={{ mr: 1, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mr: 0.5 }}>
            Tasf<span style={{ color: '#FFCDD2' }}>.B2B</span>
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#E57373', mx: 2, my: 0.5 }} />
          <Typography variant="body2" sx={{ color: '#FFCDD2', fontSize: '0.78rem' }}>
            Simulación de Colapso
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: '#FFCDD2', fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {utcClock}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box ref={containerRef} sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Map */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loadingData ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <WorldMap airports={airports} staticAirports={airports} flights={[]} simulatedTime={null} standalone />
          )}
        </Box>

        {/* Resize Handle */}
        <Box onMouseDown={handleResizeStart}
          sx={{
            width: '5px', cursor: 'col-resize', backgroundColor: '#BFBFBF', flexShrink: 0,
            transition: 'background-color 0.15s', '&:hover': { backgroundColor: ACCENT }, zIndex: 10,
          }}
        />

        {/* Right: Config Panel */}
        <Box sx={{
          width: `${panelWidth}%`, flexShrink: 0, overflow: 'auto',
          backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column',
        }}>
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <WarningIcon sx={{ fontSize: 18, color: ACCENT }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: ACCENT, fontSize: '0.95rem' }}>
                Simulación de Colapso
              </Typography>
            </Box>

            <Alert severity="warning" sx={{ mb: 2, fontSize: '0.72rem' }}>
              La simulación correrá indefinidamente hasta que algún aeropuerto supere el 100% de capacidad de su almacén.
            </Alert>

            <Divider sx={{ mb: 2 }} />

            {/* Start date */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', mb: 2 }}>
              <Box sx={{ flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', mb: 0.5 }}>
                  Duración
                </Typography>
                <Chip label="Hasta colapso" size="small"
                  sx={{ fontWeight: 700, backgroundColor: '#FFEBEE', color: ACCENT, fontSize: '0.72rem' }} />
              </Box>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', mb: 0.5, display: 'block' }}>
                  Fecha de inicio
                </FormLabel>
                <DateTimePicker
                  value={startDate}
                  onChange={(newVal) => setStartDate(newVal)}
                  slotProps={{
                    textField: {
                      size: 'small', fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } },
                    },
                  }}
                />
              </FormControl>
            </Box>

            {/* Envíos store status */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', mb: 0.75 }}>
                Datos de Envíos
              </Typography>
              {uploadedFiles.length > 0 ? (
                <Paper elevation={0}
                  sx={{ p: 1.25, border: '1px solid #A5D6A7', borderRadius: 1, backgroundColor: '#F1F8E9' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InventoryIcon sx={{ fontSize: 16, color: '#2E7D32' }} />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2E7D32', flex: 1 }}>
                      {uploadedFiles.length} archivo{uploadedFiles.length !== 1 ? 's' : ''} listos
                    </Typography>
                    <Chip label="OK" size="small"
                      sx={{ backgroundColor: '#C8E6C9', color: '#1B5E20', fontWeight: 700, fontSize: '0.6rem', height: 20 }} />
                  </Box>
                </Paper>
              ) : (
                <Alert severity="warning" sx={{ fontSize: '0.72rem', py: 0.5 }}
                  action={
                    <Tooltip title="Ir al módulo de envíos">
                      <IconButton size="small" onClick={() => navigate('/envios')}>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  }>
                  Sin archivos subidos.
                </Alert>
              )}
            </Box>

            {/* Start button */}
            <Button
              variant="contained" fullWidth size="large"
              startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={starting || creatingBatches}
              sx={{
                backgroundColor: ACCENT, fontWeight: 700, fontSize: '0.88rem', py: 1.25,
                '&:hover': { backgroundColor: ACCENT_HOVER },
              }}>
              {starting ? 'INICIANDO...' : 'INICIAR SIMULACIÓN DE COLAPSO'}
            </Button>

            <Divider sx={{ my: 1.5 }} />

            {/* Collapsible flights table */}
            <Box>
              <Button fullWidth variant="text"
                endIcon={flightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setFlightsExpanded((v) => !v)}
                sx={{ justifyContent: 'space-between', color: ACCENT, fontWeight: 600, fontSize: '0.78rem', px: 0 }}>
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

      {/* Backdrop */}
      <Backdrop
        sx={{
          color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column', gap: 2, textAlign: 'center',
          backgroundColor: 'rgba(183, 28, 28, 0.9)',
        }}
        open={starting}>
        <CircularProgress color="inherit" size={60} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Inicializando Simulación de Colapso</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300 }}>
            Leyendo envíos y optimizando rutas iniciales. La simulación correrá hasta detectar colapso...
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  )
}