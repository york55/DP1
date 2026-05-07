import { useState, useRef, useCallback, useEffect } from 'react'
import { simulationApi, airportApi, flightApi, shipmentApi } from '../api/simulationApi'
import { connectSimulationWebSocket, disconnectSimulationWebSocket } from '../websocket/simulationWebSocket'

// Fallback mock data when backend is not available
import { AIRPORTS } from '../data/mockAirports'
import { FLIGHTS } from '../data/mockFlights'
import { SHIPMENTS } from '../data/mockShipments'

const SIM_MINUTES_PER_TICK = 30
const USE_BACKEND = true // set false to use mock data only

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

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

function calcKpisMock(flights, shipments, airports) {
  const total = shipments.length
  const delayed = shipments.filter(s => s.status === 'DELAYED').length
  const onTimeDeliveryPct = total > 0 ? Math.round(((total - delayed) / total) * 100) : 100
  const inFlight = flights.filter(f => f.status === 'IN_FLIGHT')
  const avgFlightOccupancy =
    inFlight.length > 0
      ? Math.round(inFlight.reduce((s, f) => s + (f.capacity > 0 ? (f.bagsAboard / f.capacity) * 100 : 0), 0) / inFlight.length)
      : 0
  const avgWarehouseOccupancy =
    airports.length > 0 ? Math.round(airports.reduce((s, a) => s + a.occupancy, 0) / airports.length) : 0
  const totalDelayedBags = shipments.filter(s => s.status === 'DELAYED').reduce((s, x) => s + x.totalBags, 0)
  return { onTimeDeliveryPct, avgFlightOccupancy, avgWarehouseOccupancy, totalDelayedBags }
}

function updateFlightStatus(flight, simNowMs) {
  if (flight.status === 'CANCELLED') return flight
  const dep = new Date(flight.departureUTC).getTime()
  const arr = new Date(flight.arrivalUTC).getTime()
  let newStatus = simNowMs < dep ? 'SCHEDULED' : simNowMs < arr ? 'IN_FLIGHT' : 'LANDED'
  return newStatus === flight.status ? flight : { ...flight, status: newStatus }
}

function updateShipmentStatus(shipment, updatedFlights) {
  if (shipment.status === 'DELIVERED') return shipment
  if (shipment.status !== 'DELAYED' && Math.random() < 0.02) return { ...shipment, status: 'DELAYED' }
  if (!shipment.currentFlight) return shipment
  const flight = updatedFlights.find(f => f.id === shipment.currentFlight)
  if (!flight) return shipment
  let newStatus = shipment.status
  if (flight.status === 'IN_FLIGHT') newStatus = 'IN_FLIGHT'
  else if (flight.status === 'LANDED') {
    newStatus = shipment.origin === flight.origin && shipment.destination === flight.destination
      ? 'DELIVERED' : 'IN_ORIGIN'
  } else if (flight.status === 'SCHEDULED') newStatus = 'IN_ORIGIN'
  return newStatus === shipment.status ? shipment : { ...shipment, status: newStatus }
}

export function useSimulation() {
  const [simulationState, setSimulationState] = useState({
    status: 'idle',
    simulatedTime: null,
    elapsedSeconds: 0,
    config: { period: 3, startDate: new Date() },
    simulationId: null,
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

  const intervalRef = useRef(null)
  const tickCountRef = useRef(0)
  const simTimeRef = useRef(null)
  const endTimeRef = useRef(null)
  const statusRef = useRef('idle')
  const simIdRef = useRef(null)
  const useBackendRef = useRef(USE_BACKEND)

  useEffect(() => {
    simTimeRef.current = simulationState.simulatedTime
    statusRef.current = simulationState.status
  }, [simulationState.simulatedTime, simulationState.status])

  const addNotification = useCallback((message, type = 'info', persistent = false) => {
    setNotifications(prev => [...prev, makeNotification(message, type, persistent)])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n))
  }, [])

  // Handle WebSocket tick events from backend
  const handleTickEvent = useCallback((event) => {
    const simTime = new Date(
      event.simulatedTime
        ? `${new Date().toISOString().slice(0, 10)}T${event.simulatedTime.replace(' UTC', '')}`
        : new Date()
    )

    setSimulationState(prev => ({
      ...prev,
      simulatedTime: simTime,
      elapsedSeconds: event.elapsedRealSeconds,
      status: 'running',
    }))

    if (event.kpis) {
      setKpis({
        onTimeDeliveryPct: event.kpis.onTimePct ?? 100,
        avgFlightOccupancy: event.kpis.avgFlightOcc ?? 0,
        avgWarehouseOccupancy: event.kpis.avgWarehouseOcc ?? 0,
        totalDelayedBags: event.delayedBags ?? 0,
      })
    }

    if (event.airports) {
      setAirports(prev => prev.map(a => {
        const update = event.airports.find(x => x.iata === a.iata || x.iata === a.iataCode)
        if (!update) return a
        return {
          ...a,
          occupancy: update.occupancyPct,
          currentOccupancy: update.currentOccupancy,
          semaphoreLevel: update.semaphoreLevel,
        }
      }))
    }

    if (event.flights) {
      setFlights(prev => prev.map(f => {
        const update = event.flights.find(x => x.flightId === f.id || x.flightId === f.backendId)
        if (!update) return f
        return { ...f, status: update.status, progress: update.progress }
      }))
    }
  }, [])

  // Handle WebSocket alerts
  const handleAlert = useCallback((alert) => {
    const typeMap = { DELAY: 'warning', CRITICAL_OCCUPANCY: 'error', CANCELLATION: 'error' }
    addNotification(alert.message, typeMap[alert.type] || 'info',
      alert.type === 'CRITICAL_OCCUPANCY' || alert.type === 'CANCELLATION')
  }, [addNotification])

  // Mock tick for when backend is not available
  const mockTick = useCallback(() => {
    if (statusRef.current !== 'running') return
    tickCountRef.current += 1
    const currentSimTime = simTimeRef.current
    if (!currentSimTime) return
    const newSimTime = new Date(currentSimTime.getTime() + SIM_MINUTES_PER_TICK * 60 * 1000)

    if (endTimeRef.current && newSimTime >= endTimeRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      statusRef.current = 'finished'
      setSimulationState(prev => ({ ...prev, status: 'finished', simulatedTime: endTimeRef.current }))
      return
    }

    simTimeRef.current = newSimTime
    setSimulationState(prev => ({
      ...prev,
      simulatedTime: newSimTime,
      elapsedSeconds: prev.elapsedSeconds + 1,
    }))

    setFlights(prevFlights => {
      const updatedFlights = prevFlights.map(f => updateFlightStatus(f, newSimTime.getTime()))
      setShipments(prevShipments => {
        const updated = prevShipments.map(s => updateShipmentStatus(s, updatedFlights))
        setAirports(prevAirports => {
          const upd = prevAirports.map(a => ({ ...a, occupancy: clamp(a.occupancy + (Math.random() - 0.5) * 6, 5, 98) }))
          setKpis(calcKpisMock(updatedFlights, updated, upd))
          return upd
        })
        return updated
      })
      return updatedFlights
    })
  }, [])

  const startSimulation = useCallback(async (config) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    tickCountRef.current = 0
    notifCounter = 0

    const startDate = config.startDate instanceof Date ? config.startDate : new Date(config.startDate)
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
    setKpis(calcKpisMock(initialFlights, initialShipments, initialAirports))

    if (useBackendRef.current) {
      try {
        // Create simulation in backend
        const simDto = await simulationApi.create({
          scenarioType: 'PERIOD',
          periodDays: config.period,
          startDate: simStart.toISOString().slice(0, 10),
          algorithm: config.algorithm || 'ALNS',
          cancellationRate: config.cancellationRate ?? 10.0,
          seed: config.seed ?? 42,
          volumePerDay: config.volumePerDay ?? 10,
        })

        simIdRef.current = simDto.id

        // Load real airport/flight data
        const [realAirports, realFlights] = await Promise.allSettled([
          airportApi.getAll(),
          flightApi.getAll(),
        ])

        if (realAirports.status === 'fulfilled') {
          setAirports(realAirports.value.map(a => ({
            ...a,
            iata: a.iata || a.iataCode,
            iataCode: a.iata || a.iataCode,
            occupancy: a.occupancyPct || 0,
          })))
        }

        if (realFlights.status === 'fulfilled') {
          setFlights(realFlights.value.map(f => ({
            ...f,
            origin: f.originIata,
            destination: f.destinationIata,
            departureUTC: f.departureTime,
            arrivalUTC: f.arrivalTime,
            capacity: f.baggageCapacity,
            bagsAboard: f.currentLoad,
            backendId: f.id,
          })))
        }

        // Start simulation in backend
        await simulationApi.start(simDto.id)

        // Connect WebSocket
        connectSimulationWebSocket(simDto.id, handleTickEvent, handleAlert)

        setSimulationState({
          status: 'running',
          simulatedTime: simStart,
          elapsedSeconds: 0,
          config: { period: config.period, startDate: simStart },
          simulationId: simDto.id,
        })

        addNotification(
          `Simulación backend iniciada (id=${simDto.id}): ${config.period} días desde ${simStart.toISOString().slice(0, 10)}.`,
          'success'
        )
        return
      } catch (err) {
        console.warn('[useSimulation] Backend no disponible, usando modo mock:', err.message)
        addNotification('Backend no disponible. Usando modo de simulación local.', 'warning', true)
        useBackendRef.current = false
      }
    }

    // Mock fallback
    setSimulationState({
      status: 'running',
      simulatedTime: simStart,
      elapsedSeconds: 0,
      config: { period: config.period, startDate: simStart },
      simulationId: null,
    })
    addNotification(`Simulación iniciada: ${config.period} días desde ${simStart.toISOString().slice(0, 10)}.`, 'success')
    intervalRef.current = setInterval(mockTick, 1000)
  }, [handleTickEvent, handleAlert, mockTick, addNotification])

  const pauseSimulation = useCallback(async () => {
    const id = simIdRef.current
    if (id && useBackendRef.current) {
      try {
        await simulationApi.pause(id)
      } catch (e) {
        console.error('Error pausando simulación en backend', e)
      }
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
    statusRef.current = 'paused'
    setSimulationState(prev => ({ ...prev, status: 'paused' }))
    addNotification('Simulación pausada.', 'info')
  }, [addNotification])

  const resumeSimulation = useCallback(async () => {
    if (statusRef.current !== 'paused') return
    const id = simIdRef.current
    if (id && useBackendRef.current) {
      try {
        await simulationApi.resume(id)
        connectSimulationWebSocket(id, handleTickEvent, handleAlert)
      } catch (e) {
        console.error('Error reanudando simulación en backend', e)
      }
    } else {
      intervalRef.current = setInterval(mockTick, 1000)
    }
    statusRef.current = 'running'
    setSimulationState(prev => ({ ...prev, status: 'running' }))
    addNotification('Simulación reanudada.', 'info')
  }, [handleTickEvent, handleAlert, mockTick, addNotification])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      disconnectSimulationWebSocket()
    }
  }, [])

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
