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

function ScenarioCard({ icon, title, description, badge, onSelect, disabled }) {
  return (
    <Card
      elevation={disabled ? 1 : 4}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: disabled ? '4px solid #BFBFBF' : '4px solid #1F3864',
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
              backgroundColor: disabled ? '#F2F2F2' : '#E8EEF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, {
              sx: { fontSize: 28, color: disabled ? '#BFBFBF' : '#1F3864' },
            })}
          </Box>
          {badge && (
            <Chip
              label={badge}
              size="small"
              sx={{
                backgroundColor: disabled ? '#F2F2F2' : '#1F3864',
                color: disabled ? '#BFBFBF' : '#FFFFFF',
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            />
          )}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864', mb: 1, fontSize: '1rem' }}>
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
            backgroundColor: disabled ? 'transparent' : '#1F3864',
            borderColor: disabled ? '#BFBFBF' : '#1F3864',
            color: disabled ? '#BFBFBF' : '#FFFFFF',
            fontWeight: 700,
            '&:hover': {
              backgroundColor: disabled ? 'transparent' : '#162D4F',
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
      <Container maxWidth="lg">
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
            Seleccionar Escenario de Simulación
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Elige el modo de operación para iniciar la simulación
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
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
              onSelect={() => { }}
              disabled={true}
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
