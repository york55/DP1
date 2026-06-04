import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  const [shipmentsCount, setShipmentsCount] = useState(0)
  const [starting, setStarting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [uploadProgressMap, setUploadProgressMap] = useState({})
  const [completedCount, setCompletedCount] = useState(0)  // ← nuevo


  const [loadedFiles, setLoadedFiles] = useState([])
  const [fileLineCounts, setFileLineCounts] = useState({})
  const [isWaitingToStart, setIsWaitingToStart] = useState(false)

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(30) // percentage
  const isResizing = useRef(false)
  const containerRef = useRef(null)

  const stompClientRef = useRef(null)

  const periodFlightCount = flights.length

  // Resize panel handlers
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

        const mappedFlights = flightsRes.data.map((f) => ({ ...f }))

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
      debug: (str) => console.debug('[STOMP]', str),
      onConnect: () => {
        console.log('STOMP connected')
        stompClient.subscribe('/topic/shipments/progress', (message) => {
          const data = JSON.parse(message.body)
          console.log('Mensaje:', data)

          const airportCode = data.aeropuerto

          setUploadProgressMap((prev) => ({
            ...prev,
            [airportCode]: data,
          }))

          if (data.status === 'COMPLETED') {
            setCompletedCount((prev) => prev + 1)
          }

          if (data.status === 'ERROR') {
            alert(`Error en aeropuerto ${airportCode}: ${data.message}`)
            setUploading(false)
            setIsWaitingToStart(false)
          }
        })
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'])
      },
    })
    stompClient.activate()
    stompClientRef.current = stompClient
    return () => {
      stompClient.deactivate()
    }
  }, [])

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return

    const newFiles = files.filter((f) => {
      return true // deduplication handled below with existing state
    })

    setLoadedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      return [...prev, ...newFiles.filter((f) => !existingNames.has(f.name))]
    })

    newFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result
        const count = text.split('\n').filter((line) => line.trim().length > 0).length
        setFileLineCounts((prev) => ({ ...prev, [file.name]: count }))
        setShipmentsCount((prev) => prev + count)
      }
      reader.readAsText(file)
    })
  }

  // FIX 2: handleRemoveFile is now wired up to the delete button in the file list
  const handleRemoveFile = (index) => {
    setLoadedFiles((prev) => {
      const removed = prev[index]
      const updated = prev.filter((_, i) => i !== index)
      if (removed) {
        setFileLineCounts((counts) => {
          const lineCount = counts[removed.name] || 0
          setShipmentsCount((s) => Math.max(0, s - lineCount))
          const next = { ...counts }
          delete next[removed.name]
          return next
        })
      }
      if (updated.length === 0) {
        setShipmentsCount(0)
      }
      return updated
    })
  }

  useEffect(() => {
    if (!isWaitingToStart) return
    if (loadedFiles.length === 0) return
    if (completedCount < loadedFiles.length) return  // espera a que todos completen

    const run = async () => {
      try {
        setUploading(false)
        setStarting(true)
        await startSimulation({
          period: parseInt(period, 10),
          startDate: startDate,
        })
        navigate('/simulation/running')
      } catch (err) {
        console.error('Error al arrancar:', err)
        setIsWaitingToStart(false)
        setStarting(false)
      }
    }
    run()
  }, [completedCount, isWaitingToStart, loadedFiles.length])
  // ↑ dependencias mínimas: solo reacciona cuando cambia el contador

  const handleStart = async () => {
    if (!startDate) {
      alert('Por favor, seleccione la fecha de inicio.')
      return
    }
    if (loadedFiles.length === 0) {
      alert('Por favor, cargue al menos un archivo de envíos antes de iniciar.')
      return
    }

    setUploading(true)
    setIsWaitingToStart(true)

    try {
      // Clear all data from any previous run before uploading fresh batches.
      await apiClient.delete('/simulations/reset')

      for (const file of loadedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('periodo', period)
        const dateStr = startDate instanceof Date
          ? startDate.toISOString().slice(0, 10)
          : String(startDate).slice(0, 10)
        formData.append('startDate', dateStr + 'T00:00:00')

        await apiClient.post('/batches/upload', formData, {
          headers: { 'Content-Type': undefined },
        })
      }
    } catch (err) {
      console.error('Error al subir archivos:', err)
      const detail = err.response?.data?.error || err.response?.data?.message || err.message || 'Error de red'
      alert(`Error al cargar los archivos:\n${detail}`)
      setUploading(false)
      setIsWaitingToStart(false)
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

      {/* Main Content: resizable split */}
      <Box ref={containerRef} sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Map */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loadingData ? (
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            >
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
            width: '5px',
            cursor: 'col-resize',
            backgroundColor: '#BFBFBF',
            flexShrink: 0,
            transition: 'background-color 0.15s',
            '&:hover': { backgroundColor: '#2E75B6' },
            zIndex: 10,
          }}
        />

        {/* Right: Config Panel */}
        <Box
          sx={{
            width: `${panelWidth}%`,
            flexShrink: 0,
            overflow: 'auto',
            backgroundColor: '#FFFFFF',
            borderLeft: 'none',
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
              <FormLabel
                sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F3864', mb: 1, display: 'block' }}
              >
                Fecha de inicio
              </FormLabel>
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

              {/* FIX 3: show file list always (not just when !uploading), so progress bars are visible during upload */}
              {loadedFiles.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {loadedFiles.map((file, index) => {
                    const _acMatch = file.name.match(/envios_([A-Za-z]{4})_/i)
                    const airportCode = _acMatch ? _acMatch[1].toUpperCase() : null
                    const progress = uploadProgressMap[airportCode]

                    return (
                      <Box
                        key={index}
                        sx={{ mb: 2, p: 1.5, border: '1px solid #E0E0E0', borderRadius: 1 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color: '#1F3864' }} />
                          <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }}>
                            {file.name}
                          </Typography>
                          {progress?.status === 'COMPLETED' && (
                            <CheckCircleIcon sx={{ fontSize: 18, color: '#2E7D32' }} />
                          )}
                          {/* FIX 2: delete button now wired to handleRemoveFile; disabled while uploading */}
                          <Tooltip title="Eliminar archivo">
                            <span>
                              <IconButton
                                size="small"
                                disabled={uploading}
                                onClick={() => handleRemoveFile(index)}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>

                        {progress && (progress.status === 'IN_PROGRESS' || progress.status === 'COMPLETED') && (
                          <Box>
                            <LinearProgress
                              variant={progress.total > 0 ? 'determinate' : 'indeterminate'}
                              value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}
                              sx={{
                                height: 6,
                                borderRadius: 5,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: progress.status === 'COMPLETED' ? '#2E7D32' : '#2E75B6',
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#666' }}>
                              {progress.message} ({progress.processed}/{progress.total})
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )
                  })}
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

              {/* FIX 1: removed the broken second progress block that referenced undefined `uploadProgress`.
                  Per-file progress is now handled entirely inside the file list above. */}
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
                <SummaryCard label="Vuelos" value={periodFlightCount} color="#2E75B6" />
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
              {uploading ? 'PROCESANDO ARCHIVOS...' : starting ? 'INICIANDO...' : 'INICIAR SIMULACIÓN'}
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
