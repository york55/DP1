import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import FilterListIcon from '@mui/icons-material/FilterList'

const SEMAPHORE_LEVELS = [
  { key: 'green', color: '#2E7D32', label: 'Bajo' },
  { key: 'yellow', color: '#66BB6A', label: 'Mod' },
  { key: 'orange', color: '#FB8C00', label: 'Alto' },
  { key: 'deepOrange', color: '#E65100', label: 'Muy Alto' },
  { key: 'red', color: '#C62828', label: 'Crítico' },
]

const FLIGHT_STATUSES = [
  { key: 'IN_FLIGHT', label: 'En vuelo' },
  { key: 'SCHEDULED', label: 'Prog.' },
  { key: 'DELAYED', label: 'Retraso' },
  { key: 'CANCELLED', label: 'Cancelado' },
]

function Chip({ label, color, active, onClick }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        px: '7px',
        py: '2px',
        border: active ? '1.5px solid transparent' : '1.5px solid #ccc',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '0.62rem',
        fontWeight: active ? 700 : 400,
        color: active ? '#fff' : '#444',
        backgroundColor: active ? (color || '#1F3864') : '#f5f5f5',
        transition: 'all 0.15s',
        flexShrink: 0,
        '&:hover': { opacity: 0.85 },
      }}
    >
      {color && (
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          backgroundColor: active ? 'rgba(255,255,255,0.7)' : color,
        }} />
      )}
      {label}
    </Box>
  )
}

function SectionLabel({ children }) {
  return (
    <Typography variant="caption" sx={{ fontWeight: 700, color: '#1F3864', fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function Divider() {
  return <Box sx={{ borderTop: '1px solid #eee', my: 1 }} />
}

/**
 * MapFilterPanel — floating funnel-icon panel for quick map filters.
 *
 * Props:
 *   filters: { flightSemaphore: Set, flightStatus: Set, warehouseSemaphore: Set, warehouseRegion: Set }
 *   onChange(filters): called with updated filters object
 *   activeCount: number of active filter dimension selections
 *   regionOptions: string[] — unique continent values from the live airports array
 */
export default function MapFilterPanel({ filters, onChange, activeCount = 0, regionOptions = [], open: openProp, onToggle }) {
  // Controlled by the parent (to keep a single panel open at a time) when
  // open/onToggle are provided; falls back to local state otherwise.
  const [localOpen, setLocalOpen] = useState(false)
  const open = onToggle ? openProp : localOpen
  const toggle = onToggle || (() => setLocalOpen(o => !o))

  function toggleSet(setName, key) {
    const prev = new Set(filters[setName])
    if (prev.has(key)) prev.delete(key)
    else prev.add(key)
    onChange({ ...filters, [setName]: prev })
  }

  function clearAll() {
    onChange({
      flightSemaphore: new Set(),
      flightStatus: new Set(),
      warehouseSemaphore: new Set(),
      warehouseRegion: new Set(),
    })
  }

  return (
    <Box sx={{ position: 'absolute', top: 80, left: 11, zIndex: 1000 }}>
      {/* Funnel toggle button */}
      <Tooltip title="Filtros del mapa" placement="left">
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <Paper
            elevation={2}
            sx={{ borderRadius: '4px', overflow: 'hidden', backgroundColor: open ? '#1F3864' : '#fff' }}
          >
            <IconButton
              size="small"
              onClick={toggle}
              sx={{ color: open ? '#fff' : '#333', p: '6px' }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Paper>
          {activeCount > 0 && (
            <Box sx={{
              position: 'absolute', top: -5, right: -5,
              width: 16, height: 16, borderRadius: '50%',
              backgroundColor: '#E65100', color: '#fff',
              fontSize: '0.55rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', border: '1.5px solid #fff',
            }}>
              {activeCount}
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Filter panel */}
      {open && (
        <Paper
          elevation={4}
          sx={{
            mt: -4., p: 1.5, ml: 5,
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderRadius: 1.5, width: 232,
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#1F3864' }}>
              Filtros rápidos
            </Typography>
            {activeCount > 0 && (
              <Box
                component="button"
                onClick={clearAll}
                sx={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.6rem', color: '#E65100', fontWeight: 600, p: 0,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                ✕ Limpiar todo
              </Box>
            )}
          </Box>

          {/* Flights — load */}
          <SectionLabel>✈ Vuelos — carga</SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', mb: 1 }}>
            {SEMAPHORE_LEVELS.map(({ key, color, label }) => (
              <Chip
                key={key}
                label={label}
                color={color}
                active={filters.flightSemaphore.has(key)}
                onClick={() => toggleSet('flightSemaphore', key)}
              />
            ))}
          </Box>

          {/* Flights — status */}
          <SectionLabel>✈ Vuelos — estado</SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {FLIGHT_STATUSES.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                active={filters.flightStatus.has(key)}
                onClick={() => toggleSet('flightStatus', key)}
              />
            ))}
          </Box>

          <Divider />

          {/* Warehouses — occupancy */}
          <SectionLabel>🏭 Almacenes — ocupación</SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', mb: regionOptions.length ? 1 : 0 }}>
            {SEMAPHORE_LEVELS.map(({ key, color, label }) => (
              <Chip
                key={key}
                label={label}
                color={color}
                active={filters.warehouseSemaphore.has(key)}
                onClick={() => toggleSet('warehouseSemaphore', key)}
              />
            ))}
          </Box>

          {/* Warehouses — region (dynamic from live airport data) */}
          {regionOptions.length > 0 && (
            <>
              <SectionLabel>🏭 Almacenes — región</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {regionOptions.map((r) => (
                  <Chip
                    key={r}
                    label={r.length > 6 ? r.slice(0, 5) + '…' : r}
                    active={filters.warehouseRegion.has(r)}
                    onClick={() => toggleSet('warehouseRegion', r)}
                  />
                ))}
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  )
}
