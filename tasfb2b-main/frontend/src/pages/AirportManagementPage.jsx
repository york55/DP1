import React, { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import InputAdornment from '@mui/material/InputAdornment'

import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'

import AppHeader from '../components/common/Header'
import DataTable from '../components/common/DataTable'
import { airportApi } from '../api/simulationApi'

export default function AirportManagementPage() {
  const [airports, setAirports] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs States
  const [openForm, setOpenForm] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selectedAirport, setSelectedAirport] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    iataCode: '',
    city: '',
    country: '',
    continent: '',
    warehouseCapacity: 500,
    gmtOffset: 0,
    latitude: '',
    longitude: '',
  })
  
  // Validation / Error States
  const [formErrors, setFormErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  
  // Snackbar Toast notification
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const loadAirports = async () => {
    setLoading(true)
    try {
      const data = await airportApi.getAll()
      setAirports(data)
    } catch (err) {
      console.error('Error loading airports:', err)
      showToast('Error al cargar la lista de almacenes', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAirports()
  }, [])

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Filtered warehouses
  const filteredAirports = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return airports
    return airports.filter(
      (a) =>
        a.iataCode?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.country?.toLowerCase().includes(q) ||
        a.continent?.toLowerCase().includes(q)
    )
  }, [airports, searchQuery])

  // Form handlers
  const handleOpenAdd = () => {
    setSelectedAirport(null)
    setFormData({
      iataCode: '',
      city: '',
      country: '',
      continent: '',
      warehouseCapacity: 500,
      gmtOffset: 0,
      latitude: '',
      longitude: '',
    })
    setFormErrors({})
    setApiError(null)
    setOpenForm(true)
  }

  const handleOpenEdit = (airport) => {
    setSelectedAirport(airport)
    setFormData({
      iataCode: airport.iataCode || '',
      city: airport.city || '',
      country: airport.country || '',
      continent: airport.continent || '',
      warehouseCapacity: airport.warehouseCapacity || 0,
      gmtOffset: airport.gmtOffset || 0,
      latitude: airport.latitude || '',
      longitude: airport.longitude || '',
    })
    setFormErrors({})
    setApiError(null)
    setOpenForm(true)
  }

  const handleOpenDelete = (airport) => {
    setSelectedAirport(airport)
    setOpenDelete(true)
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear field-specific error
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.iataCode || formData.iataCode.trim().length < 3 || formData.iataCode.trim().length > 4) {
      errors.iataCode = 'Código IATA debe tener entre 3 y 4 caracteres'
    }
    if (!formData.city || !formData.city.trim()) {
      errors.city = 'La ciudad es obligatoria'
    }
    if (!formData.country || !formData.country.trim()) {
      errors.country = 'El país es obligatorio'
    }
    if (!formData.continent || !formData.continent.trim()) {
      errors.continent = 'El continente es obligatorio'
    }
    if (formData.warehouseCapacity === '' || Number(formData.warehouseCapacity) < 1) {
      errors.warehouseCapacity = 'La capacidad debe ser al menos 1'
    }
    if (formData.latitude === '' || isNaN(formData.latitude) || Number(formData.latitude) < -90 || Number(formData.latitude) > 90) {
      errors.latitude = 'Latitud debe ser un número entre -90 y 90'
    }
    if (formData.longitude === '' || isNaN(formData.longitude) || Number(formData.longitude) < -180 || Number(formData.longitude) > 180) {
      errors.longitude = 'Longitud debe ser un número entre -180 y 180'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setApiError(null)
    const payload = {
      ...formData,
      iataCode: formData.iataCode.trim().toUpperCase(),
      warehouseCapacity: Number(formData.warehouseCapacity),
      gmtOffset: Number(formData.gmtOffset),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
    }

    try {
      if (selectedAirport) {
        // Edit mode
        await airportApi.update(selectedAirport.id, payload)
        showToast('Almacén actualizado correctamente', 'success')
      } else {
        // Create mode
        await airportApi.create(payload)
        showToast('Almacén creado correctamente', 'success')
      }
      setOpenForm(false)
      loadAirports()
    } catch (err) {
      console.error('Error saving airport:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error al guardar el almacén'
      setApiError(errorMsg)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedAirport) return
    try {
      await airportApi.delete(selectedAirport.id)
      showToast('Almacén eliminado correctamente', 'success')
      setOpenDelete(false)
      loadAirports()
    } catch (err) {
      console.error('Error deleting airport:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error al eliminar el almacén'
      showToast(errorMsg, 'error')
      setOpenDelete(false)
    }
  }

  const columns = [
    { field: 'iataCode', headerName: 'IATA', width: 90, renderCell: (p) => <b style={{ color: '#1F3864' }}>{p.value}</b> },
    { field: 'city', headerName: 'Ciudad', width: 150 },
    { field: 'country', headerName: 'País', width: 140 },
    { field: 'continent', headerName: 'Continente', width: 120 },
    { field: 'warehouseCapacity', headerName: 'Capacidad', width: 110, type: 'number' },
    { field: 'gmtOffset', headerName: 'GMT Offset', width: 110, type: 'number', renderCell: (p) => (p.value >= 0 ? `UTC+${p.value}` : `UTC${p.value}`) },
    { field: 'latitude', headerName: 'Latitud', width: 100, type: 'number' },
    { field: 'longitude', headerName: 'Longitud', width: 100, type: 'number' },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Editar Almacén">
            <IconButton size="small" color="primary" onClick={() => handleOpenEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar Almacén">
            <IconButton size="small" color="error" onClick={() => handleOpenDelete(p.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9FAFB', pb: 8 }}>
      <AppHeader subtitle="Mantenimiento de Almacenes" backTo="/" />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          {/* Top Bar Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864' }}>
                Gestión de Almacenes de Paso
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Crea, edita, actualiza y elimina almacenes de paso del sistema de enrutamiento.
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              sx={{
                backgroundColor: '#1F3864',
                fontWeight: 700,
                px: 3,
                '&:hover': {
                  backgroundColor: '#162D4F',
                },
              }}
            >
              Nuevo Almacén
            </Button>
          </Box>

          {/* Search/Filters */}
          <Box sx={{ mb: 3 }}>
            <TextField
              size="small"
              placeholder="Buscar por IATA, ciudad, país o continente..."
              value={searchQuery}
              onChange={handleSearchChange}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 450 }}
            />
          </Box>

          {/* Data Table */}
          <DataTable
            rows={filteredAirports}
            columns={columns}
            loading={loading}
            sx={{ minHeight: 400 }}
          />
        </Paper>
      </Container>

      {/* Add / Edit Form Dialog */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleFormSubmit}>
          <DialogTitle sx={{ backgroundColor: '#1F3864', color: '#FFFFFF', fontWeight: 700 }}>
            {selectedAirport ? 'Editar Almacén' : 'Agregar Nuevo Almacén'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {apiError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {apiError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  name="iataCode"
                  label="Código IATA"
                  value={formData.iataCode}
                  onChange={handleFormChange}
                  error={!!formErrors.iataCode}
                  helperText={formErrors.iataCode}
                  disabled={!!selectedAirport} // IATA Code is typically primary/immutable for seeds
                  fullWidth
                  required
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                  placeholder="LIM"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="warehouseCapacity"
                  label="Capacidad del Almacén"
                  type="number"
                  value={formData.warehouseCapacity}
                  onChange={handleFormChange}
                  error={!!formErrors.warehouseCapacity}
                  helperText={formErrors.warehouseCapacity}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="city"
                  label="Ciudad"
                  value={formData.city}
                  onChange={handleFormChange}
                  error={!!formErrors.city}
                  helperText={formErrors.city}
                  fullWidth
                  required
                  placeholder="Lima"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="country"
                  label="País"
                  value={formData.country}
                  onChange={handleFormChange}
                  error={!!formErrors.country}
                  helperText={formErrors.country}
                  fullWidth
                  required
                  placeholder="Perú"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="continent"
                  label="Continente"
                  value={formData.continent}
                  onChange={handleFormChange}
                  error={!!formErrors.continent}
                  helperText={formErrors.continent}
                  fullWidth
                  required
                  placeholder="América del Sur"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="gmtOffset"
                  label="Desfase GMT (Huso horario)"
                  type="number"
                  value={formData.gmtOffset}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="-5"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="latitude"
                  label="Latitud"
                  type="number"
                  inputProps={{ step: 'any' }}
                  value={formData.latitude}
                  onChange={handleFormChange}
                  error={!!formErrors.latitude}
                  helperText={formErrors.latitude}
                  fullWidth
                  required
                  placeholder="-12.0219"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="longitude"
                  label="Longitud"
                  type="number"
                  inputProps={{ step: 'any' }}
                  value={formData.longitude}
                  onChange={handleFormChange}
                  error={!!formErrors.longitude}
                  helperText={formErrors.longitude}
                  fullWidth
                  required
                  placeholder="-77.1143"
                />
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setOpenForm(false)} color="inherit">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" sx={{ backgroundColor: '#1F3864', '&:hover': { backgroundColor: '#162D4F' } }}>
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle sx={{ fontWeight: 700, color: '#C62828' }}>Confirmar Eliminación</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Typography>
            ¿Está seguro que desea eliminar el almacén <b>{selectedAirport?.iataCode}</b> ({selectedAirport?.city}, {selectedAirport?.country})?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Esta acción no se puede deshacer y fallará si hay vuelos vinculados a este almacén.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDelete(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
