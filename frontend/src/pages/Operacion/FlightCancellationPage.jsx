import { useState, useEffect, useCallback } from 'react'
import { useSimulationContext } from '../../context/SimulationContext'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CancelIcon from '@mui/icons-material/Cancel'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import client from '../../api/client'

const formatTime = (timeStr) => {
  if (!timeStr) return '--'
  const str = String(timeStr)
  return str.length > 11 ? str.substring(11, 16) : str
}

export default function FlightPlanPage() {
  const { simulationState } = useSimulationContext()
  const [flights, setFlights]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [cancelling, setCancelling]   = useState(null)
  const [page, setPage]               = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [snack, setSnack]             = useState({ open: false, msg: '', severity: 'success' })

  const fetchFlights = useCallback((date) => {
    const dateParam = date ? `?date=${date}` : ''
    client.get(`/flight-ops${dateParam}`)
      .then(res => { setFlights(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const simDate = simulationState?.config?.startDate
    const dateStr = simDate
      ? (simDate instanceof Date ? simDate.toISOString() : String(simDate)).slice(0, 10)
      : null
    fetchFlights(dateStr)
  }, [simulationState?.config?.startDate, fetchFlights])

  const handleCancel = async (id) => {
    setCancelling(id)
    try {
      await client.patch(`/flight-ops/${id}/cancel`)
      setSnack({ open: true, msg: `Vuelo ${id} cancelado`, severity: 'success' })
      const simDate = simulationState?.config?.startDate
      const dateStr = simDate
        ? (simDate instanceof Date ? simDate.toISOString() : String(simDate)).slice(0, 10)
        : null
      fetchFlights(dateStr)
    } catch {
      setSnack({ open: true, msg: 'No se pudo cancelar el vuelo', severity: 'error' })
    } finally {
      setCancelling(null)
    }
  }

  const paginated = flights.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (loading) return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#1F3864' }} />
    </Box>
  )

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>Plan de Vuelos</Typography>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          {flights.length} vuelos
          {simulationState?.config?.startDate
            ? ` — ${(simulationState.config.startDate instanceof Date
                ? simulationState.config.startDate.toISOString()
                : String(simulationState.config.startDate)).slice(0, 10)}`
            : ''}
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid #E0E0E0', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {['#', 'Origen', 'Destino', 'Salida UTC', 'Llegada UTC', 'Salida Local', 'Llegada Local', 'Capacidad', 'Estado', 'Acción'].map(col => (
                  <TableCell key={col} sx={{ backgroundColor: '#1F3864', color: '#FFFFFF', fontWeight: 700, fontSize: '0.78rem' }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((f, i) => {
                // ── AGREGADO: el vuelo está "bloqueado" si el plan está cancelado
                // permanentemente O si la próxima instancia concreta ya fue cancelada
                const isCancelled = f.cancelled || f.nextInstanceCancelled

                return (
                  <TableRow
                    key={f.id}
                    sx={{
                      backgroundColor: isCancelled ? '#FFF3F3' : i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                      '&:hover': { backgroundColor: isCancelled ? '#FFE5E5' : '#E8EEF7' },
                      opacity: isCancelled ? 0.75 : 1,
                    }}
                  >
                    <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{page * rowsPerPage + i + 1}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.origin}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.destination}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>{formatTime(f.departureUtc)}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>{formatTime(f.arrivalUtc)}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{formatTime(f.departureLocal)}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{formatTime(f.arrivalLocal)}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>{f.capacity}</TableCell>
                    <TableCell>
                      {/* ── AGREGADO: chip diferenciado entre cancelado permanente vs próxima instancia ── */}
                      <Chip
                        label={f.cancelled ? 'Cancelado' : f.nextInstanceCancelled ? 'Próx. cancelado' : 'Activo'}
                        size="small"
                        sx={{
                          backgroundColor: f.cancelled ? '#FFEBEE' : f.nextInstanceCancelled ? '#FFF3E0' : '#E8F5E9',
                          color: f.cancelled ? '#C62828' : f.nextInstanceCancelled ? '#E65100' : '#2E7D32',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {!f.cancelled && (
                        // ── AGREGADO: si nextInstanceCancelled, mostrar ícono de check deshabilitado
                        // en lugar del botón de cancelar
                        f.nextInstanceCancelled ? (
                          <Tooltip title="Próxima instancia ya cancelada">
                            <span>
                              <IconButton size="small" disabled sx={{ color: '#E65100', opacity: 0.5 }}>
                                <CheckCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Cancelar vuelo">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleCancel(f.id)}
                                disabled={cancelling === f.id}
                                sx={{ color: '#C62828', '&:hover': { backgroundColor: '#FFEBEE' } }}
                              >
                                {cancelling === f.id
                                  ? <CircularProgress size={16} sx={{ color: '#C62828' }} />
                                  : <CancelIcon fontSize="small" />
                                }
                              </IconButton>
                            </span>
                          </Tooltip>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={flights.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0) }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Filas:"
          sx={{ borderTop: '1px solid #E0E0E0' }}
        />
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}