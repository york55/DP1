import { useState, useRef, useCallback, useEffect } from 'react'
import { AIRPORTS } from '../data/mockAirports'
import { FLIGHTS } from '../data/mockFlights'
import { SHIPMENTS } from '../data/mockShipments'

// Each real second = 30 simulated minutes
const SIM_MINUTES_PER_TICK = 30

const OPERATIONAL_MESSAGES = [
  { message: 'Vuelo FL-00016 reporta turbulencia moderada sobre el Atlántico.', type: 'warning' },
  { message: 'Nuevo lote de maletas registrado en aeropuerto LIM.', type: 'info' },
  { message: 'Capacidad de almacén en DXB alcanzando nivel crítico.', type: 'error' },
  { message: 'Vuelo FL-00024 en ruta transpacífica sin novedades.', type: 'info' },
  { message: 'Retraso de 45 minutos en vuelo FL-00018 por condiciones meteorológicas.', type: 'warning' },
  { message: 'Envío ENV-00006 en tránsito hacia NRT.', type: 'info' },
  { message: 'Mantenimiento preventivo programado en aeropuerto JFK.', type: 'warning' },
  { message: 'Integración de datos completada para vuelos de LATAM Airlines.', type: 'success' },
  { message: 'Alerta de capacidad: aeropuerto LHR al 82% de ocupación.', type: 'error' },
  { message: 'Sistema de enrutamiento optimizado para el período actual.', type: 'success' },
  { message: 'Vuelo FL-00031 aterrizó en SIN con 10 minutos de anticipación.', type: 'success' },
  { message: 'Revisión de seguridad adicional en vuelos provenientes de DXB.', type: 'warning' },
  { message: 'Maletas del envío ENV-00015 en proceso de carga.', type: 'info' },
  { message: 'Condiciones de viento favorables para vuelos transpacíficos.', type: 'success' },
  { message: 'Actualización de estado: 3 vuelos adelantados por ventana meteorológica.', type: 'info' },
]

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

function calcKpis(flights, shipments, airports) {
  const total = shipments.length
  const delayed = shipments.filter(s => s.status === 'DELAYED').length
  const onTimeDeliveryPct = total > 0 ? Math.round(((total - delayed) / total) * 100) : 100

  const inFlightFlights = flights.filter(f => f.status === 'IN_FLIGHT')
  const avgFlightOccupancy =
    inFlightFlights.length > 0
      ? Math.round(
          inFlightFlights.reduce(
            (sum, f) => sum + (f.capacity > 0 ? (f.bagsAboard / f.capacity) * 100 : 0),
            0
          ) / inFlightFlights.length
        )
      : 0

  const avgWarehouseOccupancy =
    airports.length > 0
      ? Math.round(airports.reduce((sum, a) => sum + a.occupancy, 0) / airports.length)
      : 0

  const totalDelayedBags = shipments
    .filter(s => s.status === 'DELAYED')
    .reduce((sum, s) => sum + s.totalBags, 0)

  return { onTimeDeliveryPct, avgFlightOccupancy, avgWarehouseOccupancy, totalDelayedBags }
}

let notifCounter = 0

function makeNotification(message, type = 'info', persistent = false) {
  notifCounter += 1
  return {
    id: `notif-${notifCounter}-${Date.now()}`,
    message,
    type,
    persistent,
    dismissed: false,
  }
}

function updateFlightStatus(flight, simNowMs) {
  if (flight.status === 'CANCELLED') return flight
  const dep = new Date(flight.departureUTC).getTime()
  const arr = new Date(flight.arrivalUTC).getTime()
  let newStatus = flight.status
  if (simNowMs < dep) newStatus = 'SCHEDULED'
  else if (simNowMs >= dep && simNowMs < arr) newStatus = 'IN_FLIGHT'
  else if (simNowMs >= arr) newStatus = 'LANDED'
  if (newStatus === flight.status) return flight
  return { ...flight, status: newStatus }
}

function updateShipmentStatus(shipment, updatedFlights) {
  if (shipment.status === 'DELIVERED') return shipment
  // 2% chance to become DELAYED per tick
  if (shipment.status !== 'DELAYED' && Math.random() < 0.02) {
    return { ...shipment, status: 'DELAYED' }
  }
  if (!shipment.currentFlight) return shipment
  const flight = updatedFlights.find(f => f.id === shipment.currentFlight)
  if (!flight) return shipment

  let newStatus = shipment.status
  let newDeliveredBags = shipment.deliveredBags

  if (flight.status === 'IN_FLIGHT') {
    newStatus = 'IN_FLIGHT'
  } else if (flight.status === 'LANDED') {
    if (shipment.origin === flight.origin && shipment.destination === flight.destination) {
      newStatus = 'DELIVERED'
      newDeliveredBags = shipment.totalBags
    } else {
      newStatus = 'IN_ORIGIN'
    }
  } else if (flight.status === 'SCHEDULED') {
    newStatus = 'IN_ORIGIN'
  }

  if (newStatus === shipment.status && newDeliveredBags === shipment.deliveredBags) return shipment
  return { ...shipment, status: newStatus, deliveredBags: newDeliveredBags }
}

export function useSimulation() {
  const [simulationState, setSimulationState] = useState({
    status: 'idle',
    simulatedTime: null,
    elapsedSeconds: 0,
    config: { period: 3, startDate: new Date() },
  })
  const [airports, setAirports] = useState(() => AIRPORTS.map(a => ({ ...a })))
  const [flights, setFlights] = useState(() => FLIGHTS.map(f => ({ ...f })))
  const [shipments, setShipments] = useState(() => SHIPMENTS.map(s => ({ ...s })))
  const [kpis, setKpis] = useState({
    onTimeDeliveryPct: 100,
    avgFlightOccupancy: 0,
    avgWarehouseOccupancy: 0,
    totalDelayedBags: 0,
  })
  const [notifications, setNotifications] = useState([])

  // Use refs to hold mutable simulation state for the tick closure
  const intervalRef = useRef(null)
  const tickCountRef = useRef(0)
  const simTimeRef = useRef(null)
  const endTimeRef = useRef(null)
  const statusRef = useRef('idle')

  // Keep refs in sync
  useEffect(() => {
    simTimeRef.current = simulationState.simulatedTime
    statusRef.current = simulationState.status
  }, [simulationState.simulatedTime, simulationState.status])

  const addNotification = useCallback((message, type = 'info', persistent = false) => {
    setNotifications(prev => [...prev, makeNotification(message, type, persistent)])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, dismissed: true } : n))
    )
  }, [])

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') return

    tickCountRef.current += 1
    const tickNum = tickCountRef.current

    const currentSimTime = simTimeRef.current
    if (!currentSimTime) return

    const newSimTime = new Date(currentSimTime.getTime() + SIM_MINUTES_PER_TICK * 60 * 1000)

    // Check if simulation period ended
    if (endTimeRef.current && newSimTime >= endTimeRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      statusRef.current = 'finished'
      simTimeRef.current = endTimeRef.current
      setSimulationState(prev => ({
        ...prev,
        status: 'finished',
        simulatedTime: endTimeRef.current,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }))
      return
    }

    simTimeRef.current = newSimTime
    const simNowMs = newSimTime.getTime()

    // Update simulated time and elapsed
    setSimulationState(prev => ({
      ...prev,
      simulatedTime: newSimTime,
      elapsedSeconds: prev.elapsedSeconds + 1,
    }))

    // Update flights
    setFlights(prevFlights => {
      const updatedFlights = prevFlights.map(f => updateFlightStatus(f, simNowMs))

      // Update shipments based on updated flight statuses
      setShipments(prevShipments => {
        const updatedShipments = prevShipments.map(s => updateShipmentStatus(s, updatedFlights))

        // Update airport occupancy
        setAirports(prevAirports => {
          const updatedAirports = prevAirports.map(a => {
            const delta = (Math.random() - 0.5) * 6 // ±3%
            return { ...a, occupancy: clamp(a.occupancy + delta, 5, 98) }
          })

          // Recalculate KPIs
          setKpis(calcKpis(updatedFlights, updatedShipments, updatedAirports))

          return updatedAirports
        })

        return updatedShipments
      })

      return updatedFlights
    })

    // Every 5 ticks, emit a random operational notification
    if (tickNum % 5 === 0) {
      const msg = OPERATIONAL_MESSAGES[Math.floor(Math.random() * OPERATIONAL_MESSAGES.length)]
      addNotification(msg.message, msg.type, msg.type === 'error')
    }
  }, [addNotification])

  const startSimulation = useCallback(
    (config) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      tickCountRef.current = 0
      notifCounter = 0

      const startDate =
        config.startDate instanceof Date ? config.startDate : new Date(config.startDate)
      const simStart = new Date(startDate)
      simStart.setUTCHours(0, 0, 0, 0)

      const endTime = new Date(simStart.getTime() + config.period * 24 * 60 * 60 * 1000)
      endTimeRef.current = endTime
      simTimeRef.current = simStart
      statusRef.current = 'running'

      const initialAirports = AIRPORTS.map(a => ({ ...a }))
      const initialFlights = FLIGHTS.map(f => ({ ...f }))
      const initialShipments = SHIPMENTS.map(s => ({ ...s }))

      setAirports(initialAirports)
      setFlights(initialFlights)
      setShipments(initialShipments)
      setNotifications([])
      setKpis(calcKpis(initialFlights, initialShipments, initialAirports))

      setSimulationState({
        status: 'running',
        simulatedTime: simStart,
        elapsedSeconds: 0,
        config: { period: config.period, startDate: simStart },
      })

      addNotification(
        `Simulación iniciada: período de ${config.period} días desde ${simStart
          .toISOString()
          .slice(0, 10)}.`,
        'success',
        false
      )

      intervalRef.current = setInterval(tick, 1000)
    },
    [tick, addNotification]
  )

  const pauseSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    statusRef.current = 'paused'
    setSimulationState(prev => ({ ...prev, status: 'paused' }))
    addNotification('Simulación pausada.', 'info', false)
  }, [addNotification])

  const resumeSimulation = useCallback(() => {
    if (statusRef.current !== 'paused') return
    statusRef.current = 'running'
    setSimulationState(prev => ({ ...prev, status: 'running' }))
    addNotification('Simulación reanudada.', 'info', false)
    intervalRef.current = setInterval(tick, 1000)
  }, [tick, addNotification])

  return {
    simulationState,
    airports,
    flights,
    shipments,
    kpis,
    notifications,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    dismissNotification,
  }
}
