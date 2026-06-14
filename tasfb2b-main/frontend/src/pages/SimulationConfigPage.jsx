import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
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
import InventoryIcon from '@mui/icons-material/Inventory'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Backdrop from '@mui/material/Backdrop'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
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
  { field: 'airlineName', headerName: 'Aerolínea', width: 90, renderCell: (p) => p.row.airlineName || p.row.airlineIata || '—' },
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

  const [period] = useState('5')
  const [startDate, setStartDate] = useState()
  const [flightsExpanded, setFlightsExpanded] = useState(false)
  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [starting, setStarting] = useState(false)
  const [creatingBatches, setCreatingBatches] = useState(false)
  const [isWaitingToStart, setIsWaitingToStart] = useState(false)

  const [storeStatus, setStoreStatus] = useState(null)
  const [batchProgressMap, setBatchProgressMap] = useState({})

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(30)
  const isResizing = useRef(false)
  const containerRef = useRef(null)
  const stompClientRef = useRef(null)

  const periodFlightCount = flights.length

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
        const [airportsRes, flightsRes, storeRes] = await Promise.all([
          apiClient.get('/airports'),
          apiClient.get('/flights'),
          apiClient.get('/envios/estado'),
        ])

        setAirports(airportsRes.data.map((a) => ({
          ...a, lat: a.latitude, lon: a.longitude,
          maxCapacity: a.warehouseCapacity, occupancy: a.currentOccupancy,
        })))
        setFlights(flightsRes.data)
        setStoreStatus(storeRes.data)
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
            setIsWaitingToStart(false)
            return
          }

          setBatchProgressMap((prev) => ({ ...prev, [data.aeropuerto]: data }))
        })
      },
      onStompError: (frame) => console.error('STOMP error', frame.headers['message']),
    })
    stompClient.activate()
    stompClientRef.current = stompClient
    return () => stompClient.deactivate()
  }, [])

  useEffect(() => {
    if (!isWaitingToStart) return

    const run = async () => {
      try {
        setStarting(true)
        await startSimulation({ period: parseInt(period, 10), startDate })
        navigate('/simulation/running')
      } catch (err) {
        console.error('Error al arrancar:', err)
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
    if (!storeStatus?.loaded) {
      alert('No hay envíos cargados en memoria. Ve al módulo de Gestión de Envíos y carga los archivos primero.')
      return
    }

    setBatchProgressMap({})
    setCreatingBatches(true)
    setIsWaitingToStart(false)

    try {
      await apiClient.delete('/simulations/reset')

      let dateStr = ''
      if (startDate instanceof Date) {
        const pad = (n) => String(n).padStart(2, '0')
        dateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:${pad(startDate.getSeconds())}`
      } else {
        dateStr = String(startDate)
      }

      await apiClient.post(`/batches/from-store?periodo=${period}&startDate=${dateStr}`)
    } catch (err) {
      console.error('Error iniciando:', err)
      const detail = err.response?.data?.error || err.response?.data?.mensaje || err.message
      alert(`Error:\n${detail}`)
      setCreatingBatches(false)
      setIsWaitingToStart(false)
    }
  }

  const batchProgressEntries = Object.entries(batchProgressMap)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2' }}>
      {/* AppBar */}
      <AppBar position="static" sx={{ backgroundColor: '#1F3864', zIndex: 10 }}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 1 }} size="small">
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
          <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.78rem' }}>
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
            <WorldMap airports={airports} flights={[]} simulatedTime={null} />
          )}
        </Box>

        {/* Resize Handle */}
        <Box
          onMouseDown={handleResizeStart}
          sx={{
            width: '5px', cursor: 'col-resize', backgroundColor: '#BFBFBF', flexShrink: 0,
            transition: 'background-color 0.15s', '&:hover': { backgroundColor: '#2E75B6' }, zIndex: 10,
          }}
        />

        {/* Right: Config Panel */}
        <Box
          sx={{
            width: `${panelWidth}%`, flexShrink: 0, overflow: 'auto',
            backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5, fontSize: '1rem' }}>
              Simulación por Período
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2.5, fontSize: '0.8rem' }}>
              Configure los parámetros y presione Iniciar para comenzar.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Period */}
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F3864', mb: 0.5 }}>
                Duración del período
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1F3864' }}>
                5 días
              </Typography>
            </Box>

            {/* Start date */}
            <FormControl sx={{ mb: 2.5, width: '100%' }}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F3864', mb: 1, display: 'block' }}>
                Fecha de inicio
              </FormLabel>
              <DateTimePicker
                value={startDate}
                onChange={(newVal) => setStartDate(newVal)}
                slotProps={{
                  textField: {
                    size: 'small', fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } },
                  },
                }}
              />
            </FormControl>

            {/* Envíos store status */}
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption"
                sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}>
                Datos de Envíos
              </Typography>

              {storeStatus?.loaded ? (
                <Paper elevation={0}
                  sx={{ p: 1.5, border: '1px solid #A5D6A7', borderRadius: 1, backgroundColor: '#F1F8E9' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InventoryIcon sx={{ fontSize: 18, color: '#2E7D32' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#2E7D32' }}>
                        {storeStatus.totalCount.toLocaleString()} envíos en memoria
                      </Typography>
                      {storeStatus.minDate && (
                        <Typography variant="caption" sx={{ color: '#558B2F', fontSize: '0.68rem' }}>
                          {storeStatus.minDate} → {storeStatus.maxDate}
                        </Typography>
                      )}
                    </Box>
                    <Chip label="Listo" size="small"
                      sx={{ backgroundColor: '#C8E6C9', color: '#1B5E20', fontWeight: 700, fontSize: '0.62rem' }} />
                  </Box>
                </Paper>
              ) : (
                <Alert severity="warning" sx={{ fontSize: '0.75rem', py: 0.5 }}
                  action={
                    <Tooltip title="Ir al módulo de envíos">
                      <IconButton size="small" onClick={() => navigate('/envios')}>
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  }>
                  Sin datos cargados. Carga los archivos primero.
                </Alert>
              )}

              {/* Batch creation progress */}
              {creatingBatches && batchProgressEntries.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#6B7280', mb: 0.5, display: 'block' }}>
                    Preparando batches para el período...
                  </Typography>
                  {batchProgressEntries.map(([code, prog]) => (
                    <Box key={code} sx={{ mb: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                          {code}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#6B7280' }}>
                          {prog.inserted || 0}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant={prog.total > 0 ? 'determinate' : 'indeterminate'}
                        value={prog.total > 0 ? (prog.processed / prog.total) * 100 : 0}
                        sx={{
                          height: 4, borderRadius: 3,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: prog.status === 'COMPLETED' ? '#2E7D32' : '#2E75B6',
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Summary cards */}
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption"
                sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}>
                Resumen del escenario
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <SummaryCard label="Aeropuertos" value={airports.length} color="#1F3864" />
                <SummaryCard label="Vuelos" value={periodFlightCount} color="#2E75B6" />
                <SummaryCard label="Envíos en store"
                  value={storeStatus?.totalCount ? storeStatus.totalCount.toLocaleString() : '—'}
                  color="#2E7D32" />
              </Box>
            </Box>

            {/* ALNS params */}
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption"
                sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}>
                Resumen de Valores
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <SummaryCard label="Ta" value="8000 ms" color="#374151" />
                <SummaryCard label="Sa" value="120 min" color="#374151" />
                <SummaryCard label="Sc" value="2 h" color="#374151" />
              </Box>
            </Box>

            {/* Start button */}
            <Button
              variant="contained" fullWidth size="large"
              startIcon={creatingBatches ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={starting || creatingBatches}
              sx={{
                backgroundColor: '#1F3864', fontWeight: 700, fontSize: '0.9rem', py: 1.5,
                '&:hover': { backgroundColor: '#162D4F' },
              }}>
              {creatingBatches ? 'PREPARANDO ENVÍOS...' : starting ? 'INICIANDO...' : 'INICIAR SIMULACIÓN'}
            </Button>

            <Divider sx={{ my: 2 }} />

            {/* Collapsible flights table */}
            <Box>
              <Button fullWidth variant="text"
                endIcon={flightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setFlightsExpanded((v) => !v)}
                sx={{ justifyContent: 'space-between', color: '#1F3864', fontWeight: 600, fontSize: '0.78rem', px: 0 }}>
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
          backgroundColor: 'rgba(31, 56, 100, 0.9)',
        }}
        open={starting}>
        <CircularProgress color="inherit" size={60} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Inicializando Simulación</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300 }}>
            Procesando envíos y optimizando rutas iniciales...
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  )
}
