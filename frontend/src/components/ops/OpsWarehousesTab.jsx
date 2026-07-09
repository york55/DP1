import { useMemo } from 'react'

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'

import DataTable from '../common/DataTable'
import SemaphoreChip from '../common/SemaphoreChip'

const DEFAULT_FILTERS = { search: '', continent: 'ALL', semaphore: 'ALL' }

// 'unknown' del backend se normaliza igual que en el mapa
function normalizeContinent(c) {
    return (!c || String(c).toLowerCase() === 'unknown') ? 'Sudamérica' : c
}

// Mismos umbrales que ya usaba este tab antes del refactor
function occupancyBucket(pct) {
    const p = pct ?? 0
    if (p < 25) return 'LOW'
    if (p < 50) return 'MEDIUM'
    if (p < 80) return 'HIGH'
    return 'CRITICAL'
}

export default function OpsWarehousesTab({
    airports = [],
    flights = [],
    shipments = [],
    selectedAirportCode,
    onAirportSelected,
    filters = DEFAULT_FILTERS,
    onFiltersChange = () => {},
}) {

    const { search, continent, semaphore } = filters

    const rows = useMemo(() => {
        return airports.map(a => ({
            id: a.iataCode,
            city: a.name,
            country: a.country,
            continent: normalizeContinent(a.continent),
            currentOccupancy: a.assignedShipments,
            warehouseCapacity: a.capacity,
            occupancy: a.occupancyPct,
        }))
    }, [airports])

    const codes = useMemo(() =>
        [...new Set(rows.map(r => r.id))].sort()
    , [rows])

    const continents = useMemo(() =>
        [...new Set(rows.map(r => r.continent))].sort()
    , [rows])

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (search) {
                const s = search.toLowerCase()
                const matchesSearch =
                    r.id.toLowerCase().includes(s) ||
                    r.city?.toLowerCase().includes(s)
                if (!matchesSearch) return false
            }
            if (continent !== 'ALL' && r.continent !== continent) return false
            if (semaphore !== 'ALL' && occupancyBucket(r.occupancy) !== semaphore) return false
            return true
        })
    }, [rows, search, continent, semaphore])

    const columns = [

        {
            field: 'id',
            headerName: 'Código',
            width: 90,
        },

        {
            field: 'city',
            headerName: 'Aeropuerto',
            width: 170,
        },

        {
            field: 'continent',
            headerName: 'Continente',
            width: 130,
        },

        {
            field: 'currentOccupancy',
            headerName: 'Ocupación',
            width: 170,

            renderCell: params => {
                const current = params.row.currentOccupancy || 0
                const capacity = params.row.warehouseCapacity || 0
                const pct = params.row.occupancy || 0

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{current}/{capacity}</span>
                        <SemaphoreChip occupancyPct={pct} />
                    </Box>
                )
            }
        },

    ]

    // La selección vive en RealtimeMapPage — un click en el mapa abre este mismo
    // detalle si el usuario está en esta pestaña.
    const selectedAirport = useMemo(() => {
        if (!selectedAirportCode) return null
        return rows.find(r => r.id === selectedAirportCode) || null
    }, [selectedAirportCode, rows])

    const selectedFlights = useMemo(() => {
        if (!selectedAirport) return []
        return flights.filter(f =>
            f.originIata === selectedAirport.id ||
            f.destIata === selectedAirport.id
        )
    }, [selectedAirport, flights])

    const originShipments = useMemo(() => {
        if (!selectedAirport) return []
        return shipments.filter(s =>
            s.originIata === selectedAirport.id && s.status === 'PLANNED'
        )
    }, [selectedAirport, shipments])

    const deliveredShipments = useMemo(() => {
        if (!selectedAirport) return []
        return shipments.filter(s =>
            s.destIata === selectedAirport.id && s.status === 'DELIVERED'
        )
    }, [selectedAirport, shipments])

    // ── Vista de detalle: reemplaza la tabla dentro del propio panel (sin Drawer) ──
    if (selectedAirport) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" onClick={() => onAirportSelected?.(null)}>
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography sx={{ fontWeight: 700, color: '#1F3864' }}>
                            {selectedAirport.id}
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => onAirportSelected?.(null)}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Divider />

                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

                    <Typography>{selectedAirport.city}</Typography>
                    <Typography color="text.secondary">
                        {selectedAirport.country} · {selectedAirport.continent}
                    </Typography>

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">Ocupación:</Typography>
                        <Typography variant="h6">
                            {selectedAirport.currentOccupancy} / {selectedAirport.warehouseCapacity}
                        </Typography>
                        <SemaphoreChip occupancyPct={selectedAirport.occupancy} />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1F3864', mb: 1 }}>
                        Stock
                    </Typography>

                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        En tránsito / Por salir ({originShipments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                        {originShipments.length === 0 ? (
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                                Sin envíos.
                            </Typography>
                        ) : originShipments.map(s => (
                            <Typography key={s.id} sx={{ fontSize: '0.78rem' }}>
                                {s.externalId} — {s.bagCount} maletas → {s.destIata}
                            </Typography>
                        ))}
                    </Box>

                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Destino final / Entregado ({deliveredShipments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {deliveredShipments.length === 0 ? (
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                                Sin envíos.
                            </Typography>
                        ) : deliveredShipments.map(s => (
                            <Typography key={s.id} sx={{ fontSize: '0.78rem' }}>
                                {s.externalId} — {s.bagCount} maletas desde {s.originIata}
                            </Typography>
                        ))}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1F3864' }}>
                        Vuelos relacionados ({selectedFlights.length})
                    </Typography>

                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedFlights.map(f => (
                            <Box key={f.flightId} sx={{ border: '1px solid #E0E0E0', borderRadius: 1, p: 1 }}>
                                <Typography variant="body2">
                                    {f.originIata} → {f.destIata}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {f.status}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                </Box>

            </Box>
        )
    }

    // ── Lista + filtros ──
    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            <Box sx={{ display: 'flex', gap: 1, p: 1, flexWrap: 'wrap' }}>

                <TextField
                    size="small"
                    label="Buscar"
                    value={search}
                    onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
                    sx={{ flex: 1, minWidth: 120 }}
                />

                <TextField
                    select
                    size="small"
                    label="Código"
                    value={codes.includes(search) ? search : 'ALL'}
                    onChange={e =>
                        onFiltersChange({
                            ...filters,
                            search: e.target.value === 'ALL' ? '' : e.target.value,
                        })
                    }
                    sx={{ width: 110 }}
                >
                    <MenuItem value="ALL">Todos</MenuItem>
                    {codes.map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    size="small"
                    label="Continente"
                    value={continent}
                    onChange={e => onFiltersChange({ ...filters, continent: e.target.value })}
                    sx={{ width: 140 }}
                >
                    <MenuItem value="ALL">Todos</MenuItem>
                    {continents.map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    size="small"
                    label="Semáforo"
                    value={semaphore}
                    onChange={e => onFiltersChange({ ...filters, semaphore: e.target.value })}
                    sx={{ width: 130 }}
                >
                    <MenuItem value="ALL">Todos</MenuItem>
                    <MenuItem value="LOW">Bajo</MenuItem>
                    <MenuItem value="MEDIUM">Medio</MenuItem>
                    <MenuItem value="HIGH">Alto</MenuItem>
                    <MenuItem value="CRITICAL">Crítico</MenuItem>
                </TextField>

            </Box>

            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                <DataTable
                    rows={filteredRows}
                    columns={columns}
                    onRowClick={(params) => onAirportSelected?.(params.row.id)}
                />
            </Box>

        </Box>
    )
}
