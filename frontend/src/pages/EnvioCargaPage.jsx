import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LuggageIcon from '@mui/icons-material/Luggage'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

export default function EnvioCargaPage() {
  const navigate = useNavigate()

  // Archivos ya subidos al servidor
  const [serverFiles, setServerFiles] = useState([])
  const [loadingServer, setLoadingServer] = useState(true)

  // Archivos seleccionados pendientes de subir
  const [pendingFiles, setPendingFiles] = useState([])

  // Estado por archivo: idle | uploading | done | error
  const [fileStatus, setFileStatus] = useState({}) // { filename: { status, error } }

  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef(null)

  // ── Cargar lista del servidor ──────────────────────────────────────────────
  const fetchServerFiles = useCallback(async () => {
    try {
      const res = await apiClient.get('/sim/uploads/archivos')
      setServerFiles(res.data)
    } catch (err) {
      console.error('Error listando archivos:', err)
    } finally {
      setLoadingServer(false)
    }
  }, [])

  useEffect(() => {
    fetchServerFiles()
  }, [fetchServerFiles])

  // ── Selección de archivos ──────────────────────────────────────────────────
  const addFiles = (files) => {
    const incoming = Array.from(files).filter((f) => f.name.endsWith('.txt'))
    if (!incoming.length) return
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...incoming.filter((f) => !existing.has(f.name))]
    })
  }

  const handleFileInput = (e) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const handleRemovePending = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    setFileStatus((prev) => {
      const copy = { ...prev }
      delete copy[pendingFiles[index].name]
      return copy
    })
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  // ── Subida ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pendingFiles.length || uploading) return
    setUploading(true)

    for (const file of pendingFiles) {
      setFileStatus((prev) => ({ ...prev, [file.name]: { status: 'uploading' } }))
      try {
        const formData = new FormData()
        formData.append('file', file)
        await apiClient.post('/sim/uploads/archivo', formData, {
          headers: { 'Content-Type': undefined },
        })
        setFileStatus((prev) => ({ ...prev, [file.name]: { status: 'done' } }))
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        setFileStatus((prev) => ({ ...prev, [file.name]: { status: 'error', error: msg } }))
      }
    }

    setUploading(false)
    // Limpiar los que salieron bien y refrescar lista del servidor
    setPendingFiles((prev) =>
      prev.filter((f) => fileStatus[f.name]?.status === 'error')
    )
    fetchServerFiles()
  }

  // ── Eliminar del servidor ──────────────────────────────────────────────────
  const handleDeleteServer = async (nombre) => {
    try {
      await apiClient.delete(`/sim/uploads/archivo/${encodeURIComponent(nombre)}`)
      setServerFiles((prev) => prev.filter((f) => f !== nombre))
    } catch (err) {
      alert('Error eliminando archivo: ' + (err.response?.data?.error || err.message))
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const statusIcon = (filename) => {
    const s = fileStatus[filename]?.status
    if (s === 'uploading') return <CircularProgress size={16} />
    if (s === 'done') return <CheckCircleIcon sx={{ fontSize: 18, color: '#2E7D32' }} />
    if (s === 'error') return <ErrorOutlineIcon sx={{ fontSize: 18, color: '#D32F2F' }} />
    return null
  }

  const allDoneOrError = pendingFiles.length > 0 &&
    pendingFiles.every((f) => fileStatus[f.name]?.status === 'done' || fileStatus[f.name]?.status === 'error')

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
            Archivos de Envíos
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3, maxWidth: 700, mx: 'auto', width: '100%' }}>

        {/* ── Archivos en servidor ── */}
        <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderTop: '3px solid #1F3864', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderOpenIcon sx={{ color: '#1F3864', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 700, color: '#1F3864', fontSize: '0.9rem' }}>
                Archivos en el servidor
              </Typography>
            </Box>
            {serverFiles.length > 0 && (
              <Chip
                label={`${serverFiles.length} archivo${serverFiles.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ backgroundColor: '#E3F2FD', color: '#1F3864', fontWeight: 700, fontSize: '0.65rem' }}
              />
            )}
          </Box>

          {loadingServer ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : serverFiles.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
              No hay archivos subidos aún.
            </Typography>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 220, overflowY: 'auto' }}>
              {serverFiles.map((nombre) => (
                <ListItem
                  key={nombre}
                  disablePadding
                  sx={{ py: 0.4, borderBottom: '1px solid #F0F0F0' }}
                  secondaryAction={
                    <Tooltip title="Eliminar del servidor">
                      <IconButton size="small" onClick={() => handleDeleteServer(nombre)}>
                        <DeleteOutlineIcon sx={{ fontSize: 16, color: '#D32F2F' }} />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color: '#2E75B6' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={nombre}
                    primaryTypographyProps={{ fontSize: '0.78rem', fontFamily: 'monospace' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* ── Subir archivos ── */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864', mb: 0.5, fontSize: '1rem' }}>
            Subir archivos de envíos
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 2.5, fontSize: '0.8rem' }}>
            Arrastra o selecciona archivos <code>envios_IATA_.txt</code>. Se guardarán en el servidor y
            se leerán al momento de configurar la simulación según el rango de fechas elegido.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* Drag & Drop zone */}
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${isDragOver ? '#1F3864' : '#B0BEC5'}`,
              borderRadius: 1,
              p: 3,
              mb: 2,
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              backgroundColor: isDragOver ? '#E3F2FD' : '#FAFAFA',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: uploading ? '#B0BEC5' : '#2E75B6', backgroundColor: uploading ? '#FAFAFA' : '#F0F7FF' },
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 36, color: isDragOver ? '#1F3864' : '#90A4AE', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#546E7A', fontWeight: 600 }}>
              Arrastra archivos .txt aquí
            </Typography>
            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
              o haz clic para seleccionar
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              multiple
              hidden
              onChange={handleFileInput}
            />
          </Box>

          {/* Lista de pendientes */}
          {pendingFiles.length > 0 && (
            <Box sx={{ mb: 2, maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
              {pendingFiles.map((file, index) => {
                const s = fileStatus[file.name]
                return (
                  <Box key={index} sx={{
                    mb: 1, p: 1.2, border: '1px solid #E0E0E0', borderRadius: 1,
                    backgroundColor: s?.status === 'error' ? '#FFF5F5' : s?.status === 'done' ? '#F5FFF6' : '#FFF',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color: '#1F3864' }} />
                      <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, fontFamily: 'monospace' }}>
                        {file.name}
                      </Typography>
                      {statusIcon(file.name)}
                      <Tooltip title="Quitar de la lista">
                        <span>
                          <IconButton size="small" disabled={uploading} onClick={() => handleRemovePending(index)}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                    {s?.status === 'uploading' && (
                      <LinearProgress sx={{ mt: 0.8, height: 4, borderRadius: 4 }} />
                    )}
                    {s?.status === 'error' && (
                      <Typography variant="caption" sx={{ color: '#D32F2F', fontSize: '0.65rem' }}>
                        {s.error}
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Botón subir */}
          <Button
            variant="contained"
            fullWidth
            disabled={uploading || pendingFiles.length === 0}
            onClick={handleUpload}
            sx={{
              py: 1.2, backgroundColor: '#1F3864', fontWeight: 700,
              '&:hover': { backgroundColor: '#162D4F' },
            }}
          >
            {uploading
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} color="inherit" />
                  Subiendo...
                </Box>
              : `Subir al servidor (${pendingFiles.length} archivo${pendingFiles.length !== 1 ? 's' : ''})`
            }
          </Button>

          {allDoneOrError && (
            <Alert severity="success" sx={{ mt: 2, fontSize: '0.78rem' }}>
              Archivos subidos correctamente. Puedes continuar a configurar la simulación.
            </Alert>
          )}

          <Alert severity="info" sx={{ mt: 2, fontSize: '0.78rem' }}>
            Los archivos se guardan en disco en el servidor. No se pierden si el servidor se reinicia.
          </Alert>
        </Paper>

        {serverFiles.length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="contained"
              onClick={() => navigate('/simulation/config')}
              sx={{ backgroundColor: '#2E7D32', '&:hover': { backgroundColor: '#1B5E20' }, fontWeight: 700 }}
            >
              Ir a Configurar Simulación
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}