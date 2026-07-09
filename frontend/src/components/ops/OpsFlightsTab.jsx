import { useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'

import DataTable from '../common/DataTable'
import SemaphoreChip from '../common/SemaphoreChip'

const STATUS_STYLES = {
    SCHEDULED: {
        label: 'Programado',
        color: '#6B7280',
        bg: '#F2F2F2',
    },

    IN_FLIGHT: {
        label: 'En Vuelo',
        color: '#E65100',
        bg: '#FFF3E0',
    },

    LANDED: {
        label: 'Aterrizó',
        color: '#2E7D32',
        bg: '#E8F5E9',
    },

    CANCELLED: {
        label: 'Cancelado',
        color: '#C62828',
        bg: '#FFEBEE',
    },
}

// ── Normaliza los valores en español que puede devolver el backend ──
const STATUS_NORMALIZE = {
    'Programado':  'SCHEDULED',
    'En vuelo':    'IN_FLIGHT',
    'En Vuelo':    'IN_FLIGHT',
    'Aterrizó':    'LANDED',
    'Cancelado':   'CANCELLED',
}

function normalizeStatus(status) {
    return STATUS_NORMALIZE[status] ?? status
}

// Mismos umbrales que usa OpsWarehousesTab, aplicados a la ocupación del vuelo
function occupancyBucket(pct) {
    const p = pct ?? 0
    if (p < 25) return 'LOW'
    if (p < 50) return 'MEDIUM'
    if (p < 80) return 'HIGH'
    return 'CRITICAL'
}

// "2026-07-09T14:30:00Z" -> "14:30"; si no viene en formato ISO, se deja tal cual.
function formatUtc(value) {
    if (typeof value === 'string' && value.includes('T')) {
        return value.slice(11, 16)
    }
    return value ?? '—'
}

function FlightStatusChip({ status }) {
    const style =
        STATUS_STYLES[status] ||
        {
            label: status,
            color: '#6B7280',
            bg: '#F2F2F2',
        }

    return (
        <Chip
            label={style.label}
            size="small"
            sx={{
                backgroundColor: style.bg,
                color: style.color,
                fontWeight: 600,
                fontSize: '0.7rem',
                border: `1px solid ${style.color}`,
            }}
        />
    )
}

export default function OpsFlightsTab({
    flights = [],
    shipments = [],
    selectedFlightId,
    onFlightSelected,
}) {

    // ── Normaliza status al entrar, una sola vez ──
    const normalizedFlights = useMemo(() =>
        flights.map(f => ({
            ...f,
            status: normalizeStatus(f.status),
        }))
    , [flights])

    // La selección vive en RealtimeMapPage — así un click en el mapa (o el vuelo
    // activo de un envío) abre este mismo detalle si el usuario está en esta pestaña.
    const selectedFlight = useMemo(() => {
        if (!selectedFlightId) return null
        return normalizedFlights.find(f => f.flightId === selectedFlightId) || null
    }, [selectedFlightId, normalizedFlights])

    // Cada envío trae la lista de vuelos en los que tiene un tramo PENDING
    // (backend: OpsShipmentRoute) — necesario porque un envío multi-tramo puede
    // no compartir origen/destino exactos con cualquiera de sus vuelos individuales.
    const flightShipments = useMemo(() => {
        if (!selectedFlight) return []
        return shipments.filter(s =>
            s.flightIds?.includes(selectedFlight.flightId)
        )
    }, [shipments, selectedFlight])

    const [search, setSearch] =
        useState('')

    const [origin, setOrigin] =
        useState('ALL')

    const [destination, setDestination] =
        useState('ALL')

    const [semaphore, setSemaphore] =
        useState('ALL')

    const origins = useMemo(() => {
        return [
            ...new Set(
                normalizedFlights.map(f => f.originIata)
            ),
        ].sort()
    }, [normalizedFlights])

    const destinations = useMemo(() => {
        return [
            ...new Set(
                normalizedFlights.map(f => f.destIata)
            ),
        ].sort()
    }, [normalizedFlights])

    const filteredFlights =
        useMemo(() => {

            return normalizedFlights.filter(f => {

                const text =
                    `${f.flightId} ${f.originIata} ${f.destIata}`
                        .toLowerCase()

                const matchesSearch =
                    !search ||
                    text.includes(search.toLowerCase())

                const matchesOrigin =
                    origin === 'ALL' ||
                    f.originIata === origin

                const matchesDestination =
                    destination === 'ALL' ||
                    f.destIata === destination

                const loadPct =
                    f.capacity > 0
                        ? (f.assignedBags / f.capacity) * 100
                        : 0

                const matchesSemaphore =
                    semaphore === 'ALL' ||
                    occupancyBucket(loadPct) === semaphore

                return (
                    matchesSearch &&
                    matchesOrigin &&
                    matchesDestination &&
                    matchesSemaphore
                )
            })

        }, [
            normalizedFlights,
            search,
            origin,
            destination,
            semaphore,
        ])

    const columns = [

        {
            field: 'originIata',
            headerName: 'Origen',
            width: 90,
        },

        {
            field: 'destIata',
            headerName: 'Destino',
            width: 90,
        },

        {
            field: 'assignedBags',
            headerName: 'Ocupación',
            width: 170,

            renderCell: params => {
                if (params.row.status === 'CANCELLED') {
                    return (
                        <Typography sx={{ fontSize: '0.78rem', color: '#C62828' }}>
                            —
                        </Typography>
                    )
                }

                const capacity =
                    params.row.capacity || 1

                const pct =
                    (params.value / capacity) * 100

                return (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <span>
                            {params.value}/{capacity}
                        </span>

                        <SemaphoreChip
                            occupancyPct={pct}
                        />
                    </Box>
                )
            }
        },

        {
            field: 'status',
            headerName: 'Estado',
            width: 110,

            renderCell: params =>
                <FlightStatusChip
                    status={params.value}
                />
        },

        {
            field: 'depTimeUtc',
            headerName: 'Salida UTC',
            width: 100,

            renderCell: params =>
                formatUtc(params.value)
        },

        {
            field: 'arrTimeUtc',
            headerName: 'Llegada UTC',
            width: 100,

            renderCell: params =>
                formatUtc(params.value)
        }

    ]

    if (selectedFlight) {

        const isCancelled = selectedFlight.status === 'CANCELLED'

        const loadPct =
            !isCancelled && selectedFlight.capacity > 0
                ? (
                    selectedFlight.assignedBags /
                    selectedFlight.capacity
                ) * 100
                : 0

        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    backgroundColor: isCancelled ? '#FFF5F5' : 'transparent',
                }}
            >

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        px: 1,
                        py: 1,
                    }}
                >

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >

                        <IconButton
                            size="small"
                            onClick={() =>
                                onFlightSelected?.(null)
                            }
                        >
                            <ArrowBackIcon />
                        </IconButton>

                        <Typography
                            sx={{
                                fontWeight: 700,
                                color: isCancelled ? '#C62828' : '#1F3864',
                            }}
                        >
                            {selectedFlight.originIata}
                            {' → '}
                            {selectedFlight.destIata}
                        </Typography>

                    </Box>

                    <IconButton
                        size="small"
                        onClick={() =>
                            onFlightSelected?.(null)
                        }
                    >
                        <CloseIcon />
                    </IconButton>

                </Box>

                <Divider />

                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                    }}
                >

                    <Typography>
                        Ruta:
                        {' '}
                        <b>
                            {selectedFlight.originIata}
                            {' → '}
                            {selectedFlight.destIata}
                        </b>
                    </Typography>

                    <Typography>
                        Estado:
                        {' '}
                        <FlightStatusChip
                            status={selectedFlight.status}
                        />
                    </Typography>

                    {!isCancelled && (
                        <>
                            <Typography>
                                Ocupación:
                                {' '}
                                {selectedFlight.assignedBags}
                                {' / '}
                                {selectedFlight.capacity}
                            </Typography>

                            <SemaphoreChip
                                occupancyPct={loadPct}
                            />

                            <Typography>
                                Progreso:
                                {' '}
                                {(
                                    selectedFlight.progress * 100
                                ).toFixed(1)}
                                %
                            </Typography>
                        </>
                    )}

                    <Typography>
                        Salida:
                        {' '}
                        {selectedFlight.depTimeUtc}
                    </Typography>

                    <Typography>
                        Llegada:
                        {' '}
                        {selectedFlight.arrTimeUtc}
                    </Typography>

                </Box>

                <Divider />

                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, color: '#1F3864', mb: 1 }}>
                        Envíos en este vuelo ({flightShipments.length})
                    </Typography>
                    {flightShipments.length === 0 ? (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                            Sin envíos asociados.
                        </Typography>
                    ) : (
                        <List dense sx={{ overflow: 'auto', maxHeight: 240 }}>
                            {flightShipments.map(s => (
                                <ListItem key={s.id} divider>
                                    <ListItemText
                                        primary={s.externalId}
                                        secondary={`${s.bagCount} maletas · ${s.cliente || ''}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>

            </Box>
        )
    }

    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >

            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    p: 1,
                    flexWrap: 'wrap',
                }}
            >

                <TextField
                    size="small"
                    label="Buscar"
                    value={search}
                    onChange={e =>
                        setSearch(e.target.value)
                    }
                    sx={{ flex: 1, minWidth: 120 }}
                />

                <TextField
                    select
                    size="small"
                    label="Origen"
                    value={origin}
                    onChange={e =>
                        setOrigin(e.target.value)
                    }
                    sx={{ width: 100 }}
                >
                    <MenuItem value="ALL">
                        Todos
                    </MenuItem>

                    {origins.map(o => (
                        <MenuItem
                            key={o}
                            value={o}
                        >
                            {o}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    size="small"
                    label="Destino"
                    value={destination}
                    onChange={e =>
                        setDestination(e.target.value)
                    }
                    sx={{ width: 100 }}
                >
                    <MenuItem value="ALL">
                        Todos
                    </MenuItem>

                    {destinations.map(d => (
                        <MenuItem
                            key={d}
                            value={d}
                        >
                            {d}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    size="small"
                    label="Semáforo"
                    value={semaphore}
                    onChange={e =>
                        setSemaphore(e.target.value)
                    }
                    sx={{ width: 120 }}
                >
                    <MenuItem value="ALL">Todos</MenuItem>
                    <MenuItem value="LOW">Bajo</MenuItem>
                    <MenuItem value="MEDIUM">Medio</MenuItem>
                    <MenuItem value="HIGH">Alto</MenuItem>
                    <MenuItem value="CRITICAL">Crítico</MenuItem>
                </TextField>

            </Box>

            <Box
                sx={{
                    flexGrow: 1,
                    minHeight: 0,
                }}
            >

                <DataTable
                    rows={filteredFlights}
                    columns={columns}
                    getRowId={(row) => row.flightId}
                    getRowClassName={(params) =>
                        params.row.status === 'CANCELLED' ? 'row-cancelled' : ''
                    }
                    sx={{
                        '& .row-cancelled': {
                            backgroundColor: '#FFF0F0',
                            opacity: 0.8,
                            '&:hover': {
                                backgroundColor: '#FFE0E0',
                            },
                        },
                    }}
                    onRowClick={(params) => {
                        onFlightSelected?.(params.row.flightId)
                    }}
                />

            </Box>

        </Box>
    )
}
