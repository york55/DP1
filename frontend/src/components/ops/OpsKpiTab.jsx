import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import KpiCard from '../simulation/KpiCard'

export default function OpsKpiTab({
  airports = [],
  flights = [],
}) {

  const totalAirports =
    airports.length

  const totalFlights =
    flights.length

  const totalCapacity =
    flights.reduce(
      (sum, f) => sum + (f.capacity || 0),
      0
    )

  const totalAssignedBags =
    flights.reduce(
      (sum, f) => sum + (f.assignedBags || 0),
      0
    )

  const avgFlightOccupancy =
    flights.length > 0
      ? flights.reduce(
          (sum, f) =>
            sum +
            (
              f.capacity > 0
                ? (f.assignedBags / f.capacity) * 100
                : 0
            ),
          0
        ) / flights.length
      : 0

  const avgWarehouseOccupancy =
    airports.length > 0
      ? airports.reduce(
          (sum, a) =>
            sum + (a.occupancyPct || 0),
          0
        ) / airports.length
      : 0

  return (
    <Box sx={{ p: 2 }}>

      <Typography
        variant="subtitle2"
        sx={{
          mb: 2,
          color: '#1F3864',
          fontWeight: 700,
        }}
      >
        Indicadores Operativos
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
        }}
      >

        <KpiCard
          label="Aeropuertos"
          value={totalAirports}
          trend="neutral"
          color="#1F3864"
        />

        <KpiCard
          label="Vuelos Activos"
          value={totalFlights}
          trend={totalFlights > 0 ? 'up' : 'neutral'}
          color="#2E75B6"
        />

        <KpiCard
          label="Capacidad Total"
          value={totalCapacity}
          unit="bags"
          trend="neutral"
          color="#FB8C00"
        />

        <KpiCard
          label="Maletas Asignadas"
          value={totalAssignedBags}
          unit="bags"
          trend={totalAssignedBags > 0 ? 'up' : 'neutral'}
          color="#2E7D32"
        />

      </Box>

      <Typography
        variant="subtitle2"
        sx={{
          mt: 3,
          mb: 2,
          color: '#1F3864',
          fontWeight: 700,
        }}
      >
        Utilización
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
        }}
      >

        <KpiCard
          label="Ocupación Vuelos"
          value={avgFlightOccupancy.toFixed(2)}
          unit="%"
          trend={
            avgFlightOccupancy > 80
              ? 'up'
              : avgFlightOccupancy > 50
                ? 'neutral'
                : 'down'
          }
          color="#1565C0"
        />

        <KpiCard
          label="Ocupación Almacenes"
          value={avgWarehouseOccupancy.toFixed(2)}
          unit="%"
          trend={
            avgWarehouseOccupancy > 80
              ? 'down'
              : avgWarehouseOccupancy > 50
                ? 'neutral'
                : 'up'
          }
          color="#E65100"
        />

      </Box>

    </Box>
  )
}