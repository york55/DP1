import { useState, useEffect } from 'react'
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

const STATUS_COLOR = {
  SCHEDULED:  { bg: '#E8EEF7', color: '#1F3864' },
  IN_FLIGHT:  { bg: '#E8F5E9', color: '#2E7D32' },
  LANDED:     { bg: '#F3E5F5', color: '#6A1B9A' },
  CANCELLED:  { bg: '#FFEBEE', color: '#C62828' },
}

export default function FlightCancellationPage() {
  const [flights, setFlights]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  useEffect(() => {
    fetch('http://localhost:8080/api/flights')
      .then(res => res.json())
      .then(data => { setFlights(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const paginated = flights.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (loading) return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#1F3864' }} />
    </Box>
  )

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>Cancelación de Vuelos</Typography>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>{flights.length} vuelos cargados</Typography>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid #E0E0E0', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {['ID', 'Aerolínea', 'Origen', 'Destino', 'Salida', 'Llegada', 'Capacidad', 'Carga', 'Estado'].map(col => (
                  <TableCell key={col} sx={{ backgroundColor: '#1F3864', color: '#FFFFFF', fontWeight: 700, fontSize: '0.78rem' }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((f, i) => (
                <TableRow key={f.id} sx={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', '&:hover': { backgroundColor: '#E8EEF7' } }}>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{f.id}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{f.airlineName}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.originIata}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.destinationIata}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{new Date(f.departureTime).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{new Date(f.arrivalTime).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{f.baggageCapacity}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{f.currentLoad}</TableCell>
                  <TableCell>
                    <Chip
                      label={f.status}
                      size="small"
                      sx={{
                        backgroundColor: STATUS_COLOR[f.status]?.bg ?? '#F2F2F2',
                        color: STATUS_COLOR[f.status]?.color ?? '#333',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
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
    </Box>
  )
}