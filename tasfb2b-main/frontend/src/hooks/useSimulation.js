import { useState, useRef, useCallback, useEffect } from 'react'
import { simulationApi, airportApi, flightApi, shipmentApi } from '../api/simulationApi'
import { connectSimulationWebSocket, disconnectSimulationWebSocket } from '../websocket/simulationWebSocket'
import { createLogger } from '../utils/logger'

const simLogger = createLogger('SimulationEngine-Frontend')

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

export function useSimulation() {
  const [simulationState, setSimulationState] = useState({
    status: 'idle',
    simulatedTime: null,
    elapsedSeconds: 0,
    config: { period: 5, startDate: new Date() },
    simulationId: null,
  })

  // Group dynamic data to reduce renders
  const [simulationData, setSimulationData] = useState({
    airports: [],
    flights: [],
    shipments: [],
    kpis: {
      onTimeDeliveryPct: 100,
      avgFlightOccupancy: 0,
      avgWarehouseOccupancy: 0,
      totalDelayedBags: 0,
    }
  })

  const [notifications, setNotifications] = useState([])

  const [planningProgress, setPlanningProgress] = useState({
    phase: '',
    iteration: 0,
    maxIterations: 1000,
    assignedBatches: 0,
    totalBatches: 0,
    currentObjective: 0,
  })

  const simTimeRef = useRef(null)
  const statusRef = useRef('idle')
  const simIdRef = useRef(null)
  const shipmentPollRef = useRef(null)

  // Refs for smooth timer interpolation between ticks
  const lastTickSimTimeRef = useRef(null)
  const lastTickRealTimeRef = useRef(null)
  const simMsPerRealMsRef = useRef(null)

  useEffect(() => {
    simTimeRef.current = simulationState.simulatedTime
    statusRef.current = simulationState.status
  }, [simulationState.simulatedTime, simulationState.status])

  // Smooth 1-second timer: increments elapsedSeconds every real second and
  // interpolates simulatedTime between WebSocket ticks so neither jumps.
  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== 'running') return
      setSimulationState(prev => {
        if (prev.status !== 'running') return prev

        let newSimTime = prev.simulatedTime
        if (lastTickSimTimeRef.current && lastTickRealTimeRef.current && simMsPerRealMsRef.current) {
          const elapsedSinceTickMs = Date.now() - lastTickRealTimeRef.current
          const interpolated = new Date(
            lastTickSimTimeRef.current.getTime() + elapsedSinceTickMs * simMsPerRealMsRef.current
          )
          if (!prev.simulatedTime || interpolated > prev.simulatedTime) {
            newSimTime = interpolated
          }
        }

        return {
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
          simulatedTime: newSimTime,
        }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const loadShipments = useCallback(async () => {
    try {
      const sms = await shipmentApi.getAll()
      if (Array.isArray(sms)) {
        setSimulationData(prev => ({
          ...prev,
          shipments: sms.map(s => ({
            id: s.id,
            status: s.status,
            origin: s.originIata || '—',
            destination: s.destinationIata || '—',
            totalBags: s.quantity || 0,
            deliveredBags: s.status === 'DELIVERED' ? (s.quantity || 0) : 0,
            client: s.airline || '—',
            currentFlight: null,
          })),
        }))
      }
    } catch (e) { /* silent */ }
  }, [])

  const addNotification = useCallback((message, type = 'info', persistent = false) => {
    setNotifications(prev => [...prev, makeNotification(message, type, persistent)])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n))
  }, [])

  // Handle WebSocket tick events from backend
  const handleTickEvent = useCallback((event) => {
    simLogger.info(`Tick recibido: día=${event.simulatedDay}, hora=${event.simulatedTime}`)
    // Use the full ISO datetime from the backend (UTC) when available; fall back to legacy HH:mm parsing
    let simTime
    if (event.simulatedIso) {
      simTime = new Date(event.simulatedIso + 'Z')
    } else {
      const currentSimDateStr = (simTimeRef.current || new Date()).toISOString().slice(0, 10)
      const timeStr = event.simulatedTime ? event.simulatedTime.replace(' UTC', '') : '00:00:00'
      simTime = new Date(`${currentSimDateStr}T${timeStr}Z`)
    }

    // Compute simulated-time speed from consecutive ticks for smooth interpolation
    const now = Date.now()
    if (lastTickSimTimeRef.current && lastTickRealTimeRef.current) {
      const simDeltaMs = simTime.getTime() - lastTickSimTimeRef.current.getTime()
      const realDeltaMs = now - lastTickRealTimeRef.current
      if (realDeltaMs > 500 && simDeltaMs > 0) {
        simMsPerRealMsRef.current = simDeltaMs / realDeltaMs
      }
    }
    lastTickSimTimeRef.current = simTime
    lastTickRealTimeRef.current = now

    // Update state — use Math.max so the locally-running timer never goes backward
    setSimulationState(prev => ({
      ...prev,
      simulatedTime: simTime,
      elapsedSeconds: Math.max(prev.elapsedSeconds, event.elapsedRealSeconds),
      status: 'running',
    }))

    setSimulationData(prev => {
      let nextAirports = prev.airports
      if (event.airports) {
        const airportUpdateMap = new Map(event.airports.map(x => [x.iata, x]))
        nextAirports = prev.airports.map(a => {
          const update = airportUpdateMap.get(a.iata) || airportUpdateMap.get(a.iataCode)
          if (!update) return a
          return {
            ...a,
            occupancy: update.occupancyPct,
            currentOccupancy: update.currentOccupancy,
            semaphoreLevel: update.semaphoreLevel,
          }
        })
      }

      let nextFlights = prev.flights
      if (event.flights) {
        const flightUpdateMap = new Map(event.flights.map(x => [x.flightId, x]))
        const matchedIds = new Set()
        nextFlights = prev.flights.map(f => {
          const update = flightUpdateMap.get(f.id) || flightUpdateMap.get(f.backendId)
          if (!update) return f
          matchedIds.add(update.flightId)
          return {
            ...f,
            status: update.status,
            progress: update.progress,
            bagsAboard: update.currentLoad,
            capacity: update.baggageCapacity || f.capacity,
            departureUTC: update.departureTime || f.departureUTC,
            arrivalUTC: update.arrivalTime || f.arrivalUTC,
            airline: update.airlineName || f.airline,
          }
        })

        // Append flights from the tick that weren't in the initial load
        const newFlights = []
        for (const [fId, update] of flightUpdateMap) {
          if (matchedIds.has(fId)) continue
          newFlights.push({
            id: update.flightId,
            backendId: update.flightId,
            origin: update.originIata,
            destination: update.destinationIata,
            status: update.status,
            progress: update.progress,
            bagsAboard: update.currentLoad,
            capacity: update.baggageCapacity,
            airline: update.airlineName || '—',
            departureUTC: update.departureTime,
            arrivalUTC: update.arrivalTime,
          })
        }
        if (newFlights.length > 0) {
          nextFlights = [...nextFlights, ...newFlights]
        }
      }

      const nextKpis = event.kpis ? {
        onTimeDeliveryPct: event.kpis.onTimePct ?? 100,
        avgFlightOccupancy: event.kpis.avgFlightOcc ?? 0,
        avgWarehouseOccupancy: event.kpis.avgWarehouseOcc ?? 0,
        totalDelayedBags: event.delayedBags ?? 0,
      } : prev.kpis

      return {
        ...prev,
        airports: nextAirports,
        flights: nextFlights,
        kpis: nextKpis
      }
    })
  }, [])

  const handlePlanProgress = useCallback((snap) => {
    if (snap.phase === 'BLOCK_START') {
      setPlanningProgress(prev => ({
        ...prev,
        phase: `Planificando día ${snap.assignedBatches + 1} de ${snap.totalBatches}`,
        iteration: 0,
        maxIterations: snap.totalBatches,
        assignedBatches: snap.assignedBatches,
        totalBatches: snap.totalBatches,
      }))
      setSimulationState(prev => ({ ...prev, status: 'planning' }))
      return
    }
    setPlanningProgress({
      phase: snap.phase,
      iteration: snap.iteration,
      maxIterations: snap.maxIterations,
      assignedBatches: snap.assignedBatches,
      totalBatches: snap.totalBatches,
      currentObjective: snap.currentObjective,
    })
  }, [])

  const handleAlert = useCallback((alert) => {
    const typeMap = { DELAY: 'warning', CRITICAL_OCCUPANCY: 'error', CANCELLATION: 'error' }
    addNotification(alert.message, typeMap[alert.type] || 'info',
      alert.type === 'CRITICAL_OCCUPANCY' || alert.type === 'CANCELLATION')
  }, [addNotification])

  const startSimulation = useCallback(async (config) => {
    notifCounter = 0

    const startDate = config.startDate instanceof Date ? config.startDate : new Date(config.startDate)
    const simStart = new Date(startDate)
    simStart.setUTCHours(0, 0, 0, 0)
    simTimeRef.current = simStart
    statusRef.current = 'running'

    setSimulationData({
      airports: [],
      flights: [],
      shipments: [],
      kpis: {
        onTimeDeliveryPct: 100,
        avgFlightOccupancy: 0,
        avgWarehouseOccupancy: 0,
        totalDelayedBags: 0,
      }
    })
    setNotifications([])

    try {
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
      simLogger.info(`Simulación backend creada satisfactoriamente. ID: ${simDto.id}`)

      const [realAirports, realFlights] = await Promise.allSettled([
        airportApi.getAll(),
        flightApi.getAll(),
      ])

      const nextAirports = realAirports.status === 'fulfilled'
        ? realAirports.value.map(a => ({
          ...a,
          iata: a.iata || a.iataCode,
          iataCode: a.iata || a.iataCode,
          lat: a.latitude,
          lon: a.longitude,
          occupancy: a.occupancyPct || 0,
        }))
        : []

      const nextFlights = realFlights.status === 'fulfilled'
        ? realFlights.value.map(f => ({
          ...f,
          origin: f.originIata,
          destination: f.destinationIata,
          departureUTC: f.departureTime,
          arrivalUTC: f.arrivalTime,
          capacity: f.baggageCapacity,
          bagsAboard: f.currentLoad,
          airline: f.airlineName || f.airlineIata || '—',
          backendId: f.id,
        }))
        : []

      setSimulationData(prev => ({
        ...prev,
        airports: nextAirports,
        flights: nextFlights,
      }))

      await simulationApi.start(simDto.id)
      connectSimulationWebSocket(simDto.id, handleTickEvent, handleAlert, handlePlanProgress)

      setSimulationState({
        status: 'planning',
        simulatedTime: simStart,
        elapsedSeconds: 0,
        config: { period: config.period, startDate: simStart },
        simulationId: simDto.id,
      })

      addNotification('Planificando rutas en segundo plano, la simulación iniciará en breve...', 'info', true)

      await loadShipments()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      shipmentPollRef.current = setInterval(loadShipments, 5000)
    } catch (err) {
      simLogger.error('Error al iniciar simulación:', err.message)
      console.warn('[useSimulation] Backend no disponible:', err.message)
      addNotification('Error al iniciar la simulación. Revisa la conexión con el backend.', 'error', true)
      statusRef.current = 'idle'
      setSimulationState(prev => ({ ...prev, status: 'idle' }))
    }
  }, [handleTickEvent, handleAlert, addNotification, loadShipments])

  const pauseSimulation = useCallback(async () => {
    const id = simIdRef.current
    if (id) {
      try { await simulationApi.pause(id) } catch (e) { console.error(e) }
    }
    statusRef.current = 'paused'
    setSimulationState(prev => ({ ...prev, status: 'paused' }))
    addNotification('Simulación pausada.', 'info')
  }, [addNotification])

  const resumeSimulation = useCallback(async () => {
    if (statusRef.current !== 'paused') return
    const id = simIdRef.current
    if (id) {
      try {
        await simulationApi.resume(id)
        connectSimulationWebSocket(id, handleTickEvent, handleAlert, handlePlanProgress)
      } catch (e) { console.error(e) }
    }
    statusRef.current = 'running'
    setSimulationState(prev => ({ ...prev, status: 'running' }))
    addNotification('Simulación reanudada.', 'info')
  }, [handleTickEvent, handleAlert, addNotification])

  // On mount: reconnect to any active simulation (handles F5 and new clients)
  useEffect(() => {
    async function reconnect() {
      try {
        const sims = await simulationApi.getAll()
        const actives = sims.filter(s => s.status === 'PLAYING' || s.status === 'BUFFERING' || s.status === 'PAUSED')
        if (!actives.length) return
        const active = actives[actives.length - 1]

        simIdRef.current = active.id
        const simTime = active.simulatedTime
          ? new Date(active.simulatedTime)
          : new Date(active.startDate)
        simTimeRef.current = simTime
        const frontendStatus = active.status === 'PLAYING' ? 'running'
          : active.status === 'BUFFERING' ? 'planning'
            : 'paused'
        statusRef.current = frontendStatus

        const [realAirports, realFlights] = await Promise.allSettled([
          airportApi.getAll(),
          flightApi.getAll(),
        ])

        const nextAirports = realAirports.status === 'fulfilled'
          ? realAirports.value.map(a => ({
            ...a,
            iata: a.iata || a.iataCode,
            iataCode: a.iata || a.iataCode,
            lat: a.latitude,
            lon: a.longitude,
            occupancy: a.occupancyPct || 0,
          }))
          : []

        const nextFlights = realFlights.status === 'fulfilled'
          ? realFlights.value.map(f => ({
            ...f,
            origin: f.originIata,
            destination: f.destinationIata,
            departureUTC: f.departureTime,
            arrivalUTC: f.arrivalTime,
            capacity: f.baggageCapacity,
            bagsAboard: f.currentLoad,
            airline: f.airlineName || f.airlineIata || '—',
            backendId: f.id,
          }))
          : []

        setSimulationData(prev => ({ ...prev, airports: nextAirports, flights: nextFlights }))
        setSimulationState({
          status: frontendStatus,
          simulatedTime: simTime,
          elapsedSeconds: 0,
          config: { period: active.periodDays, startDate: new Date(active.startDate) },
          simulationId: active.id,
        })

        await loadShipments()
        if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
        shipmentPollRef.current = setInterval(loadShipments, 5000)

        if (active.status === 'PLAYING' || active.status === 'BUFFERING' || active.status === 'PAUSED') {
          connectSimulationWebSocket(active.id, handleTickEvent, handleAlert, handlePlanProgress)
        }

        simLogger.info(`Reconectado a simulación activa ID=${active.id}, estado=${active.status}`)
      } catch (e) {
        // No active simulation found or backend unavailable — stay idle
      }
    }
    reconnect()
  }, [handleTickEvent, handleAlert, loadShipments]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      disconnectSimulationWebSocket()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
    }
  }, [])

  return {
    simulationState,
    ...simulationData,
    notifications,
    planningProgress,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    dismissNotification,
  }
}
