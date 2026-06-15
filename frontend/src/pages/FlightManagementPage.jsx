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
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Chip from '@mui/material/Chip'

import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import BlockIcon from '@mui/icons-material/Block'

import AppHeader from '../components/common/Header'
import DataTable from '../components/common/DataTable'
import { flightApi, airportApi } from '../api/simulationApi'

export default function FlightManagementPage() {
  const [flights, setFlights] = useState([])
  const [airports, setAirports] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs States
  const [openForm, setOpenForm] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [openCancel, setOpenCancel] = useState(false)
  const [selectedFlight, setSelectedFlight] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    originIata: '',
    destinationIata: '',
    departureTime: '',
    arrivalTime: '',
    baggageCapacity: 100,
    frequency: 'DAILY',
    status: 'SCHEDULED',
  })
  
  // Cancel Flight State
  const [cancelReason, setCancelReason] = useState('')
  
  // Validation / Error States
  const [formErrors, setFormErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  
  // Snackbar Toast notification
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const loadData = async () => {
    setLoading(true)
    try {
      const [flightsData, airportsData] = await Promise.all([
        flightApi.getAll(),
        airportApi.getAll()
      ])
      setFlights(flightsData)
      setAirports(airportsData)
    } catch (err) {
      console.error('Error loading data:', err)
      showToast('Error al cargar la información de vuelos/aeropuertos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Filtered flights
  const filteredFlights = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return flights
    return flights.filter(
      (f) =>
        f.originIata?.toLowerCase().includes(q) ||
        f.destinationIata?.toLowerCase().includes(q) ||
        f.status?.toLowerCase().includes(q) ||
        f.id?.toString().includes(q)
    )
  }, [flights, searchQuery])

  // Form handlers
  const handleOpenAdd = () => {
    setSelectedFlight(null)
    setFormData({
      originIata: '',
      destinationIata: '',
      departureTime: '',
      arrivalTime: '',
      baggageCapacity: 100,
      frequency: 'DAILY',
      status: 'SCHEDULED',
    })
    setFormErrors({})
    setApiError(null)
    setOpenForm(true)
  }

  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    // Format to YYYY-MM-DDTHH:MM
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleOpenEdit = (flight) => {
    setSelectedFlight(flight)
    setFormData({
      originIata: flight.originIata || '',
      destinationIata: flight.destinationIata || '',
      departureTime: formatDateTimeLocal(flight.departureTime),
      arrivalTime: formatDateTimeLocal(flight.arrivalTime),
      baggageCapacity: flight.baggageCapacity || 0,
      frequency: flight.frequency || 'DAILY',
      status: flight.status || 'SCHEDULED',
    })
    setFormErrors({})
    setApiError(null)
    setOpenForm(true)
  }

  const handleOpenDelete = (flight) => {
    setSelectedFlight(flight)
    setOpenDelete(true)
  }

  const handleOpenCancel = (flight) => {
    setSelectedFlight(flight)
    setCancelReason('')
    setOpenCancel(true)
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
    if (!formData.originIata) {
      errors.originIata = 'El aeropuerto de origen es obligatorio'
    }
    if (!formData.destinationIata) {
      errors.destinationIata = 'El aeropuerto de destino es obligatorio'
    }
    if (formData.originIata && formData.destinationIata && formData.originIata === formData.destinationIata) {
      errors.destinationIata = 'El origen y destino no pueden ser iguales'
    }
    if (!formData.departureTime) {
      errors.departureTime = 'La hora de salida es obligatoria'
    }
    if (!formData.arrivalTime) {
      errors.arrivalTime = 'La hora de llegada es obligatoria'
    }
    if (formData.departureTime && formData.arrivalTime) {
      const dep = new Date(formData.departureTime)
      const arr = new Date(formData.arrivalTime)
      if (arr <= dep) {
        errors.arrivalTime = 'La hora de llegada debe ser posterior a la salida'
      }
    }
    if (formData.baggageCapacity === '' || Number(formData.baggageCapacity) < 1) {
      errors.baggageCapacity = 'La capacidad debe ser al menos 1'
    }
    if (!formData.frequency || !formData.frequency.trim()) {
      errors.frequency = 'La frecuencia es obligatoria'
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
      baggageCapacity: Number(formData.baggageCapacity),
    }

    try {
      if (selectedFlight) {
        // Edit mode
        await flightApi.update(selectedFlight.id, payload)
        showToast('Vuelo/UT actualizado correctamente', 'success')
      } else {
        // Create mode
        await flightApi.create(payload)
        showToast('Vuelo/UT creado correctamente', 'success')
      }
      setOpenForm(false)
      loadData()
    } catch (err) {
      console.error('Error saving flight:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error al guardar el vuelo'
      setApiError(errorMsg)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFlight) return
    try {
      await flightApi.delete(selectedFlight.id)
      showToast('Vuelo/UT eliminado correctamente', 'success')
      setOpenDelete(false)
      loadData()
    } catch (err) {
      console.error('Error deleting flight:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error al eliminar el vuelo'
      showToast(errorMsg, 'error')
      setOpenDelete(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!selectedFlight || !cancelReason.trim()) return
    try {
      await flightApi.cancel(selectedFlight.id, cancelReason.trim())
      showToast('Vuelo/UT cancelado correctamente', 'success')
      setOpenCancel(false)
      loadData()
    } catch (err) {
      console.error('Error cancelling flight:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error al cancelar el vuelo'
      showToast(errorMsg, 'error')
      setOpenCancel(false)
    }
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    return timeStr.replace('T', ' ').substring(0, 16)
  }

  const columns = [
    { field: 'id', headerName: 'ID', width: 80, renderCell: (p) => <span style={{ fontFamily: 'monospace' }}>{p.value}</span> },
    { field: 'originIata', headerName: 'Origen', width: 90, renderCell: (p) => <b style={{ color: '#1F3864' }}>{p.value}</b> },
    { field: 'destinationIata', headerName: 'Destino', width: 90, renderCell: (p) => <b style={{ color: '#2E75B6' }}>{p.value}</b> },
    { field: 'departureTime', headerName: 'Salida', width: 140, renderCell: (p) => formatTime(p.value) },
    { field: 'arrivalTime', headerName: 'Llegada', width: 140, renderCell: (p) => formatTime(p.value) },
    { field: 'baggageCapacity', headerName: 'Capacidad', width: 100, type: 'number' },
    { field: 'currentLoad', headerName: 'Carga', width: 90, type: 'number' },
    { field: 'frequency', headerName: 'Frecuencia', width: 110 },
    {
      field: 'status',
      headerName: 'Estado',
      width: 125,
      renderCell: (p) => {
        let color = '#2E7D32' // green
        let bg = '#E8F5E9'
        if (p.value === 'CANCELLED') {
          color = '#C62828'
          bg = '#FFEBEE'
        } else if (p.value === 'IN_FLIGHT') {
          color = '#1565C0'
          bg = '#E3F2FD'
        } else if (p.value === 'SCHEDULED') {
          color = '#F9A825'
          bg = '#FFFDE7'
        }
        return (
          <Chip
            label={p.value}
            size="small"
            sx={{
              backgroundColor: bg,
              color: color,
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          />
        )
      }
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 140,
      sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Editar Vuelo">
            <IconButton size="small" color="primary" onClick={() => handleOpenEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {p.row.status !== 'CANCELLED' && (
            <Tooltip title="Cancelar Vuelo">
              <IconButton size="small" color="warning" onClick={() => handleOpenCancel(p.row)}>
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Eliminar Vuelo">
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
      <AppHeader subtitle="Mantenimiento de Unidades de Transporte" backTo="/" />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          {/* Top Bar Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1F3864' }}>
                Gestión de Unidades de Transporte (Vuelos)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Administra los vuelos comerciales, sus rutas de origen y destino, capacidades máximas de equipaje y frecuencias.
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
              Nuevo Vuelo
            </Button>
          </Box>

          {/* Search/Filters */}
          <Box sx={{ mb: 3 }}>
            <TextField
              size="small"
              placeholder="Buscar por IATA Origen, Destino, Estado o ID..."
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
            rows={filteredFlights}
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
            {selectedFlight ? 'Editar Vuelo/UT' : 'Agregar Vuelo/UT'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {apiError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {apiError}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={6}>
                <FormControl fullWidth required error={!!formErrors.originIata}>
                  <InputLabel>Aeropuerto de Origen</InputLabel>
                  <Select
                    name="originIata"
                    value={formData.originIata}
                    label="Aeropuerto de Origen"
                    onChange={handleFormChange}
                  >
                    {airports.map((a) => (
                      <MenuItem key={a.id} value={a.iataCode}>
                        {a.iataCode} - {a.city} ({a.country})
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.originIata && <FormHelperText>{formErrors.originIata}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={6}>
                <FormControl fullWidth required error={!!formErrors.destinationIata}>
                  <InputLabel>Aeropuerto de Destino</InputLabel>
                  <Select
                    name="destinationIata"
                    value={formData.destinationIata}
                    label="Aeropuerto de Destino"
                    onChange={handleFormChange}
                  >
                    {airports.map((a) => (
                      <MenuItem key={a.id} value={a.iataCode}>
                        {a.iataCode} - {a.city} ({a.country})
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.destinationIata && <FormHelperText>{formErrors.destinationIata}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  name="departureTime"
                  label="Hora de Salida"
                  type="datetime-local"
                  value={formData.departureTime}
                  onChange={handleFormChange}
                  error={!!formErrors.departureTime}
                  helperText={formErrors.departureTime}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  name="arrivalTime"
                  label="Hora de Llegada"
                  type="datetime-local"
                  value={formData.arrivalTime}
                  onChange={handleFormChange}
                  error={!!formErrors.arrivalTime}
                  helperText={formErrors.arrivalTime}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  name="baggageCapacity"
                  label="Capacidad de Equipaje (Maletas)"
                  type="number"
                  value={formData.baggageCapacity}
                  onChange={handleFormChange}
                  error={!!formErrors.baggageCapacity}
                  helperText={formErrors.baggageCapacity}
                  fullWidth
                  required
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  name="frequency"
                  label="Frecuencia"
                  value={formData.frequency}
                  onChange={handleFormChange}
                  error={!!formErrors.frequency}
                  helperText={formErrors.frequency}
                  fullWidth
                  required
                  placeholder="DAILY o MON-WED-FRI"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Estado del Vuelo</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    label="Estado del Vuelo"
                    onChange={handleFormChange}
                  >
                    <MenuItem value="SCHEDULED">SCHEDULED (Programado)</MenuItem>
                    <MenuItem value="IN_FLIGHT">IN_FLIGHT (En Vuelo)</MenuItem>
                    <MenuItem value="LANDED">LANDED (Aterrizado)</MenuItem>
                    <MenuItem value="CANCELLED">CANCELLED (Cancelado)</MenuItem>
                  </Select>
                </FormControl>
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

      {/* Cancel Flight Dialog */}
      <Dialog open={openCancel} onClose={() => setOpenCancel(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#F9A825' }}>Cancelar Vuelo/UT</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Typography sx={{ mb: 2 }}>
            ¿Está seguro que desea cancelar el vuelo <b>{selectedFlight?.id}</b> de <b>{selectedFlight?.originIata}</b> a <b>{selectedFlight?.destinationIata}</b>?
          </Typography>
          <TextField
            label="Motivo de la cancelación"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="Ingrese el motivo de la cancelación (ejm: Mal clima)"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCancel(false)} color="inherit">
            Atrás
          </Button>
          <Button onClick={handleCancelConfirm} variant="contained" color="warning" disabled={!cancelReason.trim()}>
            Confirmar Cancelación
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle sx={{ fontWeight: 700, color: '#C62828' }}>Confirmar Eliminación</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Typography>
            ¿Está seguro que desea eliminar la unidad de transporte <b>{selectedFlight?.id}</b> ({selectedFlight?.originIata} ➔ {selectedFlight?.destinationIata})?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Esta acción es irreversible y eliminará el registro del vuelo permanentemente del sistema.
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
