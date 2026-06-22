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
    onFlightSelected,
}) {

    const [selectedFlight, setSelectedFlight] =
        useState(null)

    const [search, setSearch] =
        useState('')

    const [origin, setOrigin] =
        useState('ALL')

    const [destination, setDestination] =
        useState('ALL')

    const origins = useMemo(() => {
        return [
            ...new Set(
                flights.map(f => f.originIata)
            ),
        ].sort()
    }, [flights])

    const destinations = useMemo(() => {
        return [
            ...new Set(
                flights.map(f => f.destIata)
            ),
        ].sort()
    }, [flights])

    const filteredFlights =
        useMemo(() => {

            return flights.filter(f => {

                const text =
                    `${f.originIata} ${f.destIata}`
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

                return (
                    matchesSearch &&
                    matchesOrigin &&
                    matchesDestination
                )
            })

        }, [
            flights,
            search,
            origin,
            destination,
        ])

    const columns = [

        {
            field: 'route',
            headerName: 'Ruta',
            width: 120,

            valueGetter: params =>
                `${params.row.originIata} → ${params.row.destIata}`,
        },

        {
            field: 'assignedBags',
            headerName: 'Ocupación',
            width: 180,

            renderCell: params => {

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
            width: 120,

            renderCell: params =>
                <FlightStatusChip
                    status={params.value}
                />
        }

    ]

    if (selectedFlight) {

        const loadPct =
            selectedFlight.capacity > 0
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
                                setSelectedFlight(null)
                            }
                        >
                            <ArrowBackIcon />
                        </IconButton>

                        <Typography
                            sx={{
                                fontWeight: 700,
                                color: '#1F3864',
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
                            setSelectedFlight(null)
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
                    sx={{ flex: 1 }}
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
                    onRowClick={(params) => {

                        setSelectedFlight(params.row)

                        onFlightSelected?.(
                            params.row.flightId
                        )

                    }}
                />

            </Box>

        </Box>
    )
}