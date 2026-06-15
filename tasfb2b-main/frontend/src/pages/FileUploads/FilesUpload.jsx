import { useEffect, useState, useRef, useCallback } from 'react'
import AppHeader from '../../components/common/Header'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import UploadIcon from '@mui/icons-material/Upload'
import client from '../../api/client'

export default function FilesUpload() {
  const [pendingFiles, setPendingFiles] = useState([])
  const [existingFiles, setExistingFiles] = useState([])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()

  const fetchExisting = async () => {
    setLoadingExisting(true)
    setError(null)
    try {
      const res = await client.get('/files')
      setExistingFiles(res.data)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoadingExisting(false)
    }
  }

  useEffect(() => { fetchExisting() }, [])

  const addFiles = useCallback((files) => {
    const valid = [...files].filter(f => f.name.endsWith('.txt'))
    setPendingFiles(prev => {
      const existingNames = prev.map(f => f.name)
      return [...prev, ...valid.filter(f => !existingNames.includes(f.name))]
    })
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const handleUploadAll = async () => {
    setUploading(true)
    setError(null)
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        await client.post('/files', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } catch (err) {
        setError(`Error subiendo ${file.name}: ${err.response?.data || err.message}`)
      }
    }
    setPendingFiles([])
    setUploading(false)
    fetchExisting()
  }

  const handleDelete = async (filename) => {
    try {
      await client.delete(`/files/${filename}`)
      setExistingFiles(prev => prev.filter(f => f !== filename))
    } catch {
      setError('No se pudo eliminar el archivo.')
    }
  }

  return (
    <>
      <AppHeader />
      <Box sx={{ maxWidth: 640, mx: 'auto', mt: 6, px: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1F3864" mb={0.5}>
          Carga de Archivos
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Arrastra archivos .txt o selecciónalos. Revisa antes de subir.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Drop zone */}
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          sx={{
            border: `2px dashed ${dragOver ? '#1F3864' : '#CBD5E1'}`,
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            backgroundColor: dragOver ? '#E8EEF7' : '#F9FAFB',
            cursor: 'pointer',
            transition: 'all 0.15s',
            mb: 3,
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 40, color: '#1F3864', mb: 1 }} />
          <Typography fontWeight={500} mb={0.5}>Arrastra archivos .txt aquí</Typography>
          <Typography variant="body2" color="text.secondary" mb={1.5}>o</Typography>
          <Button variant="contained" sx={{ backgroundColor: '#1F3864', '&:hover': { backgroundColor: '#162D4F' } }}>
            Seleccionar archivos
          </Button>
        </Box>
        <input ref={fileInputRef} type="file" accept=".txt" multiple hidden onChange={e => { addFiles(e.target.files); fileInputRef.current.value = '' }} />

        {/* Pending */}
        {pendingFiles.length > 0 && (
          <Box mb={3}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Por subir
            </Typography>
            <Box mt={1}>
              {pendingFiles.map((f, i) => (
                <Box key={f.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #BFDBFE', borderLeft: '3px solid #2E75B6', borderRadius: 2, p: '8px 12px', mb: 1, backgroundColor: '#F0F7FF' }}>
                  <InsertDriveFileIcon sx={{ color: '#2E75B6', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{f.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{(f.size / 1024).toFixed(1)} KB</Typography>
                  <Chip label="Pendiente" size="small" sx={{ backgroundColor: '#DBEAFE', color: '#1E40AF', fontSize: '0.65rem' }} />
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setPendingFiles(prev => prev.filter((_, j) => j !== i)) }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button variant="contained" startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />} disabled={uploading} onClick={handleUploadAll} sx={{ backgroundColor: '#1F3864', '&:hover': { backgroundColor: '#162D4F' } }}>
                {uploading ? 'Subiendo...' : 'Subir todos'}
              </Button>
              <Button variant="outlined" onClick={() => setPendingFiles([])} sx={{ borderColor: '#CBD5E1', color: '#6B7280' }}>
                Limpiar
              </Button>
            </Box>
          </Box>
        )}

        {/* Existing */}
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          En servidor
        </Typography>
        <Box mt={1}>
          {loadingExisting ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          ) : existingFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No hay archivos en el servidor.</Typography>
          ) : existingFiles.map(name => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #BBF7D0', borderLeft: '3px solid #16A34A', borderRadius: 2, p: '8px 12px', mb: 1, backgroundColor: '#F0FDF4' }}>
              <InsertDriveFileIcon sx={{ color: '#16A34A', fontSize: 18 }} />
              <Typography variant="body2" sx={{ flex: 1 }}>{name}</Typography>
              <Chip label="En servidor" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: '0.65rem' }} />
              <IconButton size="small" color="error" onClick={() => handleDelete(name)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  )
}