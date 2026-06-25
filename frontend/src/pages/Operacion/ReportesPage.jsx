import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'

import FlightIcon from '@mui/icons-material/Flight'
import FlightLandIcon from '@mui/icons-material/FlightLand'
import CancelIcon from '@mui/icons-material/Cancel'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import LuggageIcon from '@mui/icons-material/Luggage'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import PercentIcon from '@mui/icons-material/Percent'
import SearchIcon from '@mui/icons-material/Search'

import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

import client from '../../api/client'

// ── Paleta coherente con el proyecto ─────────────────────────────────────────
const C = {
    navy:   '#1F3864',
    blue:   '#2E75B6',
    green:  '#2E7D32',
    orange: '#E65100',
    red:    '#C62828',
    amber:  '#FB8C00',
    grey:   '#6B7280',
    lightGreen: '#388E3C',
}

function KpiCard({ icon, label, value, unit, color }) {
    return (
        <Box
            sx={{
                backgroundColor: '#FFFFFF',
                borderRadius: 2,
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${color}`,
                height: '100%',
            }}
        >
            <Box
                sx={{
                    backgroundColor: color + '18',
                    borderRadius: '50%',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color,
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>

            <Box>
                <Typography sx={{ fontSize: '0.72rem', color: C.grey, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: C.navy, lineHeight: 1.2 }}>
                    {value}
                    {unit && (
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: C.grey, ml: 0.5 }}>
                            {unit}
                        </Typography>
                    )}
                </Typography>
            </Box>
        </Box>
    )
}

function SectionTitle({ children }) {
    return (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            {children}
        </Typography>
    )
}

function ChartCard({ title, children, height = 260 }) {
    return (
        <Paper
            elevation={0}
            sx={{
                backgroundColor: '#FFFFFF',
                borderRadius: 2,
                p: 2.5,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                height: '100%',
            }}
        >
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: C.navy, mb: 2 }}>
                {title}
            </Typography>
            <Box sx={{ height }}>
                {children}
            </Box>
        </Paper>
    )
}

const CUSTOM_TOOLTIP_STYLE = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    fontSize: '0.78rem',
}

export default function ReportesPage() {

    const today = new Date().toISOString().split('T')[0]

    const [fecha, setFecha] = useState(today)
    const [reporte, setReporte] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchReporte = async (f) => {
        setLoading(true)
        setError(null)
        try {
            const res = await client.get(`/ops/reporte/diario?fecha=${f}`)
            setReporte(res.data)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchReporte(today) }, [])

    // ── Datos para gráficos ───────────────────────────────────────────────────
    const flightsPieData = reporte ? [
        { name: 'Operados',   value: reporte.vuelosOperados,   color: C.green  },
        { name: 'Cancelados', value: reporte.vuelosCancelados, color: C.red    },
        {
            name: 'Programados',
            value: Math.max(0, reporte.totalVuelos - reporte.vuelosOperados - reporte.vuelosCancelados),
            color: C.grey,
        },
    ].filter(d => d.value > 0) : []

    const shipmentsBarData = reporte ? [
        { name: 'Registrados', maletas: reporte.maletasRegistradas, color: C.blue   },
        { name: 'Entregados',  maletas: reporte.maletasEntregadas,  color: C.green  },
    ] : []

    const rendimientoData = reporte ? [
        { name: 'A tiempo',   value: Math.max(0, reporte.enviosRegistrados - reporte.enviosRetrasados), color: C.green },
        { name: 'Retrasados', value: reporte.enviosRetrasados, color: C.red },
    ].filter(d => d.value > 0) : []

    return (
        <Box
            sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                p: 3,
                gap: 3,
                overflow: 'auto',
                backgroundColor: '#F2F2F2',
            }}
        >

            {/* ── Header ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: C.navy }}>
                        Reporte Diario de Operaciones
                    </Typography>
                    <Typography variant="body2" sx={{ color: C.grey }}>
                        Resumen de vuelos, envíos y maletas por día
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        type="date"
                        size="small"
                        value={fecha}
                        onChange={e => setFecha(e.target.value)}
                        inputProps={{ max: today }}
                        sx={{ backgroundColor: '#FFFFFF', borderRadius: 1 }}
                    />
                    <IconButton
                        onClick={() => fetchReporte(fecha)}
                        sx={{ backgroundColor: C.navy, color: '#FFFFFF', '&:hover': { backgroundColor: C.blue } }}
                    >
                        <SearchIcon />
                    </IconButton>
                </Box>
            </Box>

            <Divider />

            {/* ── Loading / Error ── */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress sx={{ color: C.navy }} />
                </Box>
            )}

            {error && (
                <Box sx={{ backgroundColor: '#FFEBEE', border: `1px solid ${C.red}`, borderRadius: 2, p: 2 }}>
                    <Typography sx={{ color: C.red, fontSize: '0.875rem' }}>
                        No se pudo cargar el reporte: {error}
                    </Typography>
                </Box>
            )}

            {!loading && reporte && (
                <>
                    {/* ── KPIs Vuelos ── */}
                    <Box>
                        <SectionTitle>Vuelos</SectionTitle>
                        <Grid container spacing={2}>
                            {[
                                { icon: <FlightIcon />,         label: 'Total del día',  value: reporte.totalVuelos,      color: C.navy   },
                                { icon: <FlightLandIcon />,     label: 'Operados',       value: reporte.vuelosOperados,   color: C.green  },
                                { icon: <CancelIcon />,         label: 'Cancelados',     value: reporte.vuelosCancelados, color: C.red    },
                                { icon: <LocalShippingIcon />,  label: 'Con envíos',     value: reporte.vuelosConEnvios,  color: C.orange },
                            ].map(k => (
                                <Grid item xs={12} sm={6} md={3} key={k.label}>
                                    <KpiCard {...k} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    {/* ── KPIs Envíos ── */}
                    <Box>
                        <SectionTitle>Envíos y Maletas</SectionTitle>
                        <Grid container spacing={2}>
                            {[
                                { icon: <LocalShippingIcon />, label: 'Registrados',         value: reporte.enviosRegistrados,  color: C.blue       },
                                { icon: <LuggageIcon />,       label: 'Maletas registradas',  value: reporte.maletasRegistradas, color: C.blue,  unit: 'bags' },
                                { icon: <CheckCircleIcon />,   label: 'Entregados',           value: reporte.enviosEntregados,   color: C.green      },
                                { icon: <LuggageIcon />,       label: 'Maletas entregadas',   value: reporte.maletasEntregadas,  color: C.lightGreen, unit: 'bags' },
                            ].map(k => (
                                <Grid item xs={12} sm={6} md={3} key={k.label}>
                                    <KpiCard {...k} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    {/* ── KPIs Rendimiento ── */}
                    <Box>
                        <SectionTitle>Rendimiento</SectionTitle>
                        <Grid container spacing={2}>
                            {[
                                {
                                    icon: <WarningIcon />,
                                    label: 'Envíos retrasados',
                                    value: reporte.enviosRetrasados,
                                    color: reporte.enviosRetrasados > 0 ? C.red : C.green,
                                },
                                {
                                    icon: <PercentIcon />,
                                    label: 'Ocupación promedio',
                                    value: reporte.ocupacionPromedioVuelos,
                                    unit: '%',
                                    color: C.amber,
                                },
                            ].map(k => (
                                <Grid item xs={12} sm={6} md={3} key={k.label}>
                                    <KpiCard {...k} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <Divider />

                    {/* ── Gráficos ── */}
                    <Box>
                        <SectionTitle>Visualización</SectionTitle>
                        <Grid container spacing={2}>

                            {/* Pie: distribución de vuelos */}
                            <Grid item xs={12} md={4}>
                                <ChartCard title="Distribución de Vuelos">
                                    {flightsPieData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={flightsPieData}
                                                    cx="50%"
                                                    cy="45%"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {flightsPieData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                                                <Legend
                                                    iconType="circle"
                                                    iconSize={8}
                                                    wrapperStyle={{ fontSize: '0.75rem' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                            <Typography sx={{ color: C.grey, fontSize: '0.8rem' }}>Sin vuelos este día</Typography>
                                        </Box>
                                    )}
                                </ChartCard>
                            </Grid>

                            {/* Bar: maletas registradas vs entregadas */}
                            <Grid item xs={12} md={4}>
                                <ChartCard title="Maletas: Registradas vs Entregadas">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={shipmentsBarData} barSize={48}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                                            <Bar dataKey="maletas" radius={[4, 4, 0, 0]}>
                                                {shipmentsBarData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </Grid>

                            {/* Pie: envíos a tiempo vs retrasados */}
                            <Grid item xs={12} md={4}>
                                <ChartCard title="Puntualidad de Envíos">
                                    {rendimientoData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={rendimientoData}
                                                    cx="50%"
                                                    cy="45%"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {rendimientoData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                                                <Legend
                                                    iconType="circle"
                                                    iconSize={8}
                                                    wrapperStyle={{ fontSize: '0.75rem' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                            <Typography sx={{ color: C.grey, fontSize: '0.8rem' }}>Sin envíos registrados</Typography>
                                        </Box>
                                    )}
                                </ChartCard>
                            </Grid>

                        </Grid>
                    </Box>
                </>
            )}

        </Box>
    )
}