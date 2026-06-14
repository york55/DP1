import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LuggageIcon from '@mui/icons-material/Luggage'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'

export default function EnvioCargaPage() {
  const navigate = useNavigate()

  const [storeStatus, setStoreStatus] = useState(null)
  const [loadedFiles, setLoadedFiles] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [uploading, setUploading] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)

  const stompClientRef = useRef(null)
  const pendingCountRef = useRef(0)

  useEffect(() => {
    fetchEstado()
  }, [])

  const fetchEstado = async () => {
    try {
      const res = await apiClient.get('/envios/estado')
      setStoreStatus(res.data)
    } catch (err) {
      console.error('Error obteniendo estado:', err)
    }
  }

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || '/ws'
    const socket = new SockJS(wsUrl)
    const stompClient = new Client({
      webSocketFactory: () => socket,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe('/topic/envios/carga', (message) => {
          const data = JSON.parse(message.body)
          const code = data.aeropuerto

          setProgressMap((prev) => ({ ...prev, [code]: data }))

          if (data.status === 'COMPLETED') {
            setCompletedCount((prev) => prev + 1)
          }
          if (data.status === 'ERROR') {
            setUploading(false)
            alert(`Error en ${code}: ${data.mensaje || data.message}`)
          }
        })
      },
      onStompError: (frame) => console.error('STOMP error', frame.headers['message']),
    })
    stompClient.activate()
    stompClientRef.current = stompClient
    return () => stompClient.deactivate()
  }, [])

  // When all pending uploads complete, refresh store status
  useEffect(() => {
    if (!uploading) return
    if (completedCount < pendingCountRef.current) return

    setUploading(false)
    fetchEstado()
  }, [completedCount, uploading])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return

    setLoadedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...files.filter((f) => !existing.has(f.name))]
    })
  }

  const handleRemoveFile = (index) => {
    setLoadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!loadedFiles.length) return

    const filesToUpload = [...loadedFiles]
    pendingCountRef.current = filesToUpload.length
    setCompletedCount(0)
    setProgressMap({})
    setUploading(true)

    for (const file of filesToUpload) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        await apiClient.post('/envios/cargar', formData, {
          headers: { 'Content-Type': undefined },
        })
      } catch (err) {
        console.error('Error subiendo', file.name, err)
        const detail = err.response?.data?.error || err.message
        alert(`Error subiendo ${file.name}:\n${detail}`)
        setUploading(false)
        return
      }
    }
  }

  const handleLimpiar = async () => {
    if (!window.confirm('¿Limpiar todos los envíos cargados en memoria?')) return
    await apiClient.delete('/envios/limpiar')
    setLoadedFiles([])
    setProgressMap({})
    setCompletedCount(0)
    fetchEstado()
  }

  const airportCodeOf = (filename) => {
    const m = filename?.match(/envios_([A-Za-z]{4})_/i)
    return m ? m[1].toUpperCase() : null
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F2' }}>
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
            Gestión de Envíos
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3, maxWidth: 700, mx: 'auto', width: '100%' }}>
        {/* Store status */}
        {storeStatus && (
          <Paper elevation={1} sx={{ p: 2, mb: 3, borderTop: '3px solid #2E7D32', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#1F3864', fontSize: '0.9rem' }}>
                  {storeStatus.loaded ? 'Datos cargados en memoria' : 'Sin datos en memoria'}
                </Typography>
                {storeStatus.loaded && (
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    {storeStatus.totalCount.toLocaleString()} envíos
                    {storeStatus.minDate && ` · ${storeStatus.minDate} → ${storeStatus.maxDate}`}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {storeStatus.loaded && (
                  <Chip label="Listo para simular" size="small"
                    sx={{ backgroundColor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: '0.65rem' }} />
                )}
                {storeStatus.loaded && (
                  <Tooltip title="Limpiar datos en memoria">
                    <IconButton size="small" onClick={handleLimpiar}>
                      <DeleteSweepIcon sx={{ fontSize: 18, color: '#D32F2F' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Paper>
        )}

        {/* Upload section */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5, fontSize: '1rem' }}>
            Cargar archivos de envíos
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 2.5, fontSize: '0.8rem' }}>
            Selecciona uno o varios archivos <code>_envios_IATA_.txt</code>. Los datos se acumulan en memoria y
            podrás seleccionar el rango de fechas al configurar la simulación.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* File list */}
          {loadedFiles.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {loadedFiles.map((file, index) => {
                const code = airportCodeOf(file.name)
                const progress = progressMap[code]

                return (
                  <Box key={index}
                    sx={{ mb: 1.5, p: 1.5, border: '1px solid #E0E0E0', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: progress ? 1 : 0 }}>
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color: '#1F3864' }} />
                      <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, fontFamily: 'monospace' }}>
                        {file.name}
                      </Typography>
                      {progress?.status === 'COMPLETED' && (
                        <CheckCircleIcon sx={{ fontSize: 18, color: '#2E7D32' }} />
                      )}
                      <Tooltip title="Quitar de la lista">
                        <span>
                          <IconButton size="small" disabled={uploading} onClick={() => handleRemoveFile(index)}>
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
                            height: 5, borderRadius: 5,
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: progress.status === 'COMPLETED' ? '#2E7D32' : '#2E75B6',
                            },
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#666' }}>
                          {progress.message || progress.mensaje}
                          {progress.total > 0 && ` (${progress.processed}/${progress.total})`}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Select files button */}
          <Button component="label" variant="outlined" fullWidth disabled={uploading}
            startIcon={<CloudUploadIcon />}
            sx={{ mb: 2, py: 1, borderColor: '#2E75B6', color: '#2E75B6' }}>
            Seleccionar archivos TXT
            <input type="file" accept=".txt" multiple hidden onChange={handleFileSelect} />
          </Button>

          {/* Upload button */}
          <Button variant="contained" fullWidth disabled={uploading || loadedFiles.length === 0}
            onClick={handleUpload}
            sx={{ py: 1.2, backgroundColor: '#1F3864', fontWeight: 700,
              '&:hover': { backgroundColor: '#162D4F' } }}>
            {uploading
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} color="inherit" />
                  Procesando...
                </Box>
              : `Cargar en memoria (${loadedFiles.length} archivo${loadedFiles.length !== 1 ? 's' : ''})`}
          </Button>

          {!storeStatus?.loaded && !uploading && (
            <Alert severity="info" sx={{ mt: 2, fontSize: '0.78rem' }}>
              Los datos se mantienen en memoria mientras el servidor esté activo.
              No es necesario recargar entre simulaciones a menos que cambies los archivos.
            </Alert>
          )}
        </Paper>

        {storeStatus?.loaded && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/simulation/config')}
              sx={{ backgroundColor: '#2E7D32', '&:hover': { backgroundColor: '#1B5E20' }, fontWeight: 700 }}>
              Ir a Configurar Simulación
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
