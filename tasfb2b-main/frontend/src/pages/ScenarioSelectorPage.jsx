import React from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import StreamIcon from '@mui/icons-material/Stream'
import WarningIcon from '@mui/icons-material/Warning'
import LuggageIcon from '@mui/icons-material/Luggage'
import FlightIcon from '@mui/icons-material/Flight'
import SettingsIcon from '@mui/icons-material/Settings'
import InventoryIcon from '@mui/icons-material/Inventory'

const ACCENT_SIM = '#1F3864'
const ACCENT_CFG = '#92400E'

function ScenarioCard({ icon, title, description, badge, onSelect, disabled, variant = 'simulation' }) {
  const accent = disabled ? '#BFBFBF' : variant === 'config' ? ACCENT_CFG : ACCENT_SIM
  const accentBg = disabled ? '#F2F2F2' : variant === 'config' ? '#FEF3C7' : '#E8EEF7'
  const hoverColor = variant === 'config' ? '#78350F' : '#162D4F'

  return (
    <Card
      elevation={disabled ? 1 : 4}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `4px solid ${accent}`,
        opacity: disabled ? 0.65 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': disabled ? {} : {
          transform: 'translateY(-4px)',
          boxShadow: 8,
        },
      }}
    >
      <CardContent sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              backgroundColor: accentBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, {
              sx: { fontSize: 28, color: accent },
            })}
          </Box>
          {badge && (
            <Chip
              label={badge}
              size="small"
              sx={{
                backgroundColor: disabled ? '#F2F2F2' : accentBg,
                color: disabled ? '#BFBFBF' : accent,
                border: `1px solid ${disabled ? '#BFBFBF' : accent}`,
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            />
          )}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, color: accent, mb: 1, fontSize: '1rem' }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', lineHeight: 1.6 }}>
          {description}
        </Typography>
      </CardContent>

      <CardActions sx={{ p: 3, pt: 0 }}>
        <Button
          variant={disabled ? 'outlined' : 'contained'}
          fullWidth
          onClick={onSelect}
          disabled={disabled}
          sx={{
            backgroundColor: disabled ? 'transparent' : accent,
            borderColor: disabled ? '#BFBFBF' : accent,
            color: disabled ? '#BFBFBF' : '#FFFFFF',
            fontWeight: 700,
            '&:hover': {
              backgroundColor: disabled ? 'transparent' : hoverColor,
            },
          }}
        >
          {disabled ? 'No disponible' : 'Seleccionar'}
        </Button>
      </CardActions>
    </Card>
  )
}

export default function ScenarioSelectorPage() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1F3864 0%, #2E75B6 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
      }}
    >
      {/* Logo / Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
          <LuggageIcon sx={{ fontSize: 48, color: '#FFFFFF' }} />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.5px',
              fontSize: { xs: '2rem', md: '3rem' },
            }}
          >
            Tasf<span style={{ color: '#90CAF9' }}>.B2B</span>
          </Typography>
        </Box>
        <Typography
          variant="subtitle1"
          sx={{ color: '#90CAF9', fontWeight: 400, letterSpacing: '0.1em', fontSize: '0.95rem' }}
        >
          SISTEMA DE ENRUTAMIENTO DE EQUIPAJE
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255,255,255,0.6)', mt: 1, maxWidth: 500, mx: 'auto' }}
        >
          Plataforma de simulación para el seguimiento y optimización del flujo de maletas en operaciones aéreas internacionales.
        </Typography>
      </Box>

      {/* Scenario Cards */}
      <Container maxWidth="xl">
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
            Seleccionar Escenario de Simulación
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Elige el modo de operación para iniciar la simulación o gestiona la infraestructura
          </Typography>
        </Box>

        {/* Simulation scenarios */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>
            Modos de Simulación
          </Typography>
        </Box>
        <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<CalendarMonthIcon />}
              title="Simulación por Período"
              description="Simula 5 días completos de operaciones aéreas. Observa el flujo de maletas, la ocupación de aeropuertos y el desempeño de vuelos en tiempo acelerado."
              badge="Disponible"
              onSelect={() => navigate('/simulation/config')}
              disabled={false}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<StreamIcon />}
              title="Operaciones en Tiempo Real"
              description="Conecta con datos en vivo del sistema de enrutamiento para monitoreo continuo de operaciones. Integración con APIs externas de aerolíneas."
              badge="Próximamente"
              onSelect={() => navigate('/operacion')}
              disabled={false}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<WarningIcon />}
              title="Simulación de Colapso"
              description="Evalúa la resiliencia del sistema bajo condiciones extremas: cancelaciones masivas, tormentas, cierres de aeropuertos y acumulación crítica de maletas."
              badge="Próximamente"
              onSelect={() => { }}
              disabled={true}
            />
          </Grid>
        </Grid>

        {/* Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>
            Configuración de Infraestructura
          </Typography>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </Box>

        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<InventoryIcon />}
              title="Gestión de Envíos"
              description="Carga los archivos de envíos (_envios_IATA_.txt) en memoria. Los datos persisten entre simulaciones y se filtran por fecha al iniciar cada corrida."
              badge="Nuevo"
              onSelect={() => navigate('/envios')}
              disabled={false}
              variant="config"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<SettingsIcon />}
              title="Mantenimiento de Almacenes"
              description="Administra la red de almacenes de paso (aeropuertos). Agrega nuevos almacenes, actualiza sus coordenadas, capacidad máxima y huso horario."
              badge="Nuevo"
              onSelect={() => navigate('/almacenes')}
              disabled={false}
              variant="config"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <ScenarioCard
              icon={<FlightIcon />}
              title="Mantenimiento de UT (Vuelos)"
              description="Administra las Unidades de Transporte (vuelos). Permite ingresar nuevos vuelos, modificar la capacidad de equipaje, origen, destino y horarios."
              badge="Nuevo"
              onSelect={() => navigate('/vuelos')}
              disabled={false}
              variant="config"
            />
          </Grid>
        </Grid>

        {/* Footer note */}
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Tasf.B2B v0.1.0 — Proyecto de Simulación Universitaria · DP1
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
