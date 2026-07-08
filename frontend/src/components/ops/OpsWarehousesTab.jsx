import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'

import CloseIcon from '@mui/icons-material/Close'

import DataTable from '../common/DataTable'
import SemaphoreChip from '../common/SemaphoreChip'

export default function OpsWarehousesTab({
    airports = [],
    flights = [],
    shipments = [],
    selectedAirportCode,
    onAirportSelected,
}) {

    const [selectedAirport, setSelectedAirport] = useState(null)

    const [search, setSearch] = useState('')
    const [semaphore, setSemaphore] = useState('ALL')


    const rows = useMemo(() => {

        return airports.map(a => ({

            id: a.iataCode,

            city: a.name,
            country: a.country,

            currentOccupancy: a.assignedShipments,

            warehouseCapacity: a.capacity,

            occupancy: a.occupancyPct,

            raw: a,

        }))

    }, [airports])

    const filteredRows = useMemo(() => {

        return rows.filter(r => {

            const matchesSearch =
                !search ||
                r.id.toLowerCase().includes(search.toLowerCase()) ||
                r.city.toLowerCase().includes(search.toLowerCase())

            if (!matchesSearch) return false

            if (semaphore === 'LOW')
                return r.occupancy < 25

            if (semaphore === 'MEDIUM')
                return r.occupancy >= 25 && r.occupancy < 50

            if (semaphore === 'HIGH')
                return r.occupancy >= 50 && r.occupancy < 80

            if (semaphore === 'CRITICAL')
                return r.occupancy >= 80

            return true
        })

    }, [rows, search, semaphore])

    const columns = [

        {
            field: 'id',
            headerName: 'Código',
            width: 90,
        },

        {
            field: 'city',
            headerName: 'Aeropuerto',
            width: 180,
            valueGetter: params =>
                `${params.row.city}`
        },

        {
            field: 'currentOccupancy',
            headerName: 'Ocupación',
            width: 180,

            renderCell: params => {

                const current =
                    params.row.currentOccupancy || 0

                const capacity =
                    params.row.warehouseCapacity || 0

                const pct =
                    params.row.occupancy || 0

                return (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <span>
                            {current}/{capacity}
                        </span>

                        <SemaphoreChip
                            occupancyPct={pct}
                        />
                    </Box>
                )
            }
        },

    ]

    const selectedFlights = useMemo(() => {

        if (!selectedAirport) return []

        return flights.filter(f =>
            f.originIata === selectedAirport.id ||
            f.destIata === selectedAirport.id
        )

    }, [selectedAirport, flights])

    // Stock del almacén: envíos esperando salida (en origen) vs. entregados (destino final).
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


    useEffect(() => {

        if (!selectedAirportCode)
            return

        const airport =
            rows.find(
                r => r.id === selectedAirportCode
            )

        if (airport)
            setSelectedAirport(airport)

    }, [
        selectedAirportCode,
        rows
    ])

    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}
        >

            {/* Filtros */}

            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    p: 1,
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
                    label="Semáforo"
                    value={semaphore}
                    onChange={e =>
                        setSemaphore(e.target.value)
                    }
                    sx={{ width: 130 }}
                >
                    <MenuItem value="ALL">Todos</MenuItem>
                    <MenuItem value="LOW">Bajo</MenuItem>
                    <MenuItem value="MEDIUM">Medio</MenuItem>
                    <MenuItem value="HIGH">Alto</MenuItem>
                    <MenuItem value="CRITICAL">Crítico</MenuItem>
                </TextField>

            </Box>

            {/* Tabla */}

            <Box
                sx={{
                    flexGrow: 1,
                    minHeight: 0,
                }}
            >

                <DataTable
                    rows={filteredRows}
                    columns={columns}
                    onRowClick={(params) => {

                        setSelectedAirport(params.row)

                        onAirportSelected?.(
                            params.row.id
                        )

                    }}
                />

            </Box>

            {/* Drawer */}

            <Drawer
                anchor="right"
                open={Boolean(selectedAirport)}
                onClose={() =>
                    setSelectedAirport(null)
                }
                PaperProps={{
                    sx: {
                        width: 360,
                        p: 2,
                    }
                }}
            >

                {selectedAirport && (

                    <Box>

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >

                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#1F3864',
                                    fontWeight: 700,
                                }}
                            >
                                {selectedAirport.id}
                            </Typography>

                            <IconButton
                                onClick={() =>
                                    setSelectedAirport(null)
                                }
                            >
                                <CloseIcon />
                            </IconButton>

                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography>
                            {selectedAirport.city}
                        </Typography>

                        <Typography
                            color="text.secondary"
                        >
                            {selectedAirport.country}
                        </Typography>

                        <Box sx={{ mt: 2 }}>

                            <Typography
                                variant="body2"
                            >
                                Ocupación:
                            </Typography>

                            <Typography
                                variant="h6"
                            >
                                {selectedAirport.currentOccupancy}
                                {' / '}
                                {selectedAirport.warehouseCapacity}
                            </Typography>

                            <SemaphoreChip
                                occupancyPct={
                                    selectedAirport.occupancy
                                }
                            />

                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 700,
                                color: '#1F3864',
                                mb: 1,
                            }}
                        >
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
                            Destino Final / Entregado ({deliveredShipments.length})
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

                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 700,
                                color: '#1F3864',
                            }}
                        >
                            Vuelos relacionados
                        </Typography>

                        <Box
                            sx={{
                                mt: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                            }}
                        >

                            {selectedFlights.map(f => (

                                <Box
                                    key={f.id}
                                    sx={{
                                        border: '1px solid #E0E0E0',
                                        borderRadius: 1,
                                        p: 1,
                                    }}
                                >

                                    <Typography
                                        variant="body2"
                                    >
                                        {f.originIata}
                                        {' → '}
                                        {f.destIata}
                                    </Typography>

                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {f.status}
                                    </Typography>

                                </Box>

                            ))}

                        </Box>

                    </Box>

                )}

            </Drawer>

        </Box>
    )
}