import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
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
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import LuggageIcon from '@mui/icons-material/Luggage'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import WorldMap from '../components/map/WorldMap'
import { useSimulationContext } from '../context/SimulationContext'
import { useClock } from '../hooks/useClock'
import DataTable from '../components/common/DataTable'
import { formatFlightTime } from '../utils/timeUtils'

const flightColumns = [
  { field: 'id', headerName: 'ID', width: 110, renderCell: (p) => <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.value}</span> },
  { field: 'airline', headerName: 'Aerolínea', width: 90, renderCell: () => 'TASF' },
  { field: 'originIata', headerName: 'Origen', width: 80 },
  { field: 'destinationIata', headerName: 'Destino', width: 90 },
  { field: 'departureTime', headerName: 'Salida UTC', width: 105, renderCell: (p) => formatFlightTime(p.value) },
  { field: 'arrivalTime', headerName: 'Llegada UTC', width: 105, renderCell: (p) => formatFlightTime(p.value) },
  {
    field: 'baggageCapacity',
    headerName: 'Cap.',
    width: 65,
    type: 'number',
  },
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

  const [period, setPeriod] = useState('3')
  const [startDate, setStartDate] = useState(new Date())
  const [flightsExpanded, setFlightsExpanded] = useState(false)
  const [airports, setAirports] = useState([])
  const [flights, setFlights] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [shipmentsCount, setShipmentsCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, status: '', message: '' })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [airportsRes, flightsRes] = await Promise.all([
          apiClient.get('/airports'),
          apiClient.get('/flights')
        ])
        
        // Map backend Airport fields to what WorldMap expects if needed
        const mappedAirports = airportsRes.data.map(a => ({
          ...a,
          lat: a.latitude,
          lon: a.longitude,
          maxCapacity: a.warehouseCapacity,
          occupancy: a.currentOccupancy
        }))
        
        const mappedFlights = flightsRes.data.map(f => ({
          ...f,
          originIata: f.originAirport?.iataCode,
          destinationIata: f.destinationAirport?.iataCode
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
      debug: (str) => { console.log(str) },
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
            alert("Error en la carga: " + progress.message)
          }
        })
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'])
      }
    })
    stompClient.activate()
    return () => stompClient.deactivate()
  }, [])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploading(true)
      setUploadProgress({ processed: 0, total: 0, status: 'IN_PROGRESS', message: 'Iniciando carga...' })
      const formData = new FormData()
      formData.append('file', file)
      
      try {
        await apiClient.post('/batches/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } catch (err) {
        console.error("Error al subir archivo", err)
        setUploading(false)
        alert("Fallo al iniciar subida masiva.")
      }
    }
  }

  const handleStart = async () => {
    if (shipmentsCount === 0) {
      alert("Por favor, cargue el archivo de envíos antes de iniciar.")
      return
    }
    await startSimulation({ period: parseInt(period, 10), startDate })
    navigate('/simulation/running')
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
          <Typography variant="caption" sx={{ color: '#90CAF9', fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {utcClock}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content: 70/30 split */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Map (70%) */}
        <Box sx={{ flex: '0 0 70%', position: 'relative' }}>
          {loadingData ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
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
            {/* Scenario heading */}
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5, fontSize: '1rem' }}>
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
              <RadioGroup
                row
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {['3', '5', '7'].map(d => (
                  <FormControlLabel
                    key={d}
                    value={d}
                    control={
                      <Radio
                        size="small"
                        sx={{ '&.Mui-checked': { color: '#1F3864' } }}
                      />
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
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#1F3864', display: 'block', mb: 1, fontSize: '0.78rem' }}>
                Datos de Envíos (TXT)
              </Typography>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                disabled={uploading}
                startIcon={<CloudUploadIcon />}
                sx={{ py: 1, borderColor: '#2E75B6', color: '#2E75B6' }}
              >
                Cargar Archivo de Envíos
                <input
                  type="file"
                  accept=".txt"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#1F3864' }}>
                    {uploadProgress.message} ({uploadProgress.processed} / {uploadProgress.total || '?'})
                  </Typography>
                  <LinearProgress 
                    variant={uploadProgress.total > 0 ? "determinate" : "indeterminate"} 
                    value={uploadProgress.total > 0 ? (uploadProgress.processed / uploadProgress.total) * 100 : 0} 
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
              sx={{
                backgroundColor: '#1F3864',
                fontWeight: 700,
                fontSize: '0.9rem',
                py: 1.5,
                '&:hover': { backgroundColor: '#162D4F' },
              }}
            >
              INICIAR SIMULACIÓN
            </Button>

            <Divider sx={{ my: 2 }} />

            {/* Collapsible flights table */}
            <Box>
              <Button
                fullWidth
                variant="text"
                endIcon={flightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setFlightsExpanded(v => !v)}
                sx={{ justifyContent: 'space-between', color: '#1F3864', fontWeight: 600, fontSize: '0.78rem', px: 0 }}
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
    </Box>
  )
}
