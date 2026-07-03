import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { clpSimulationApi } from '../api/clpSimulationApi'
import { airportApi, flightApi, shipmentApi } from '../api/simulationApi'
import { connectSimulationWebSocket, disconnectSimulationWebSocket } from '../websocket/simulationWebSocket'

/**
 * Lightweight hook for the Collapse (Clp) simulation scenario.
 * Same tick-event interface as useSimulation but calls /api/clp-simulations.
 * No fixed periodDays — runs until an airport collapses (>100% occupancy).
 */
export function useClpSimulation() {
  const [simulationState, setSimulationState] = useState({
    status: 'idle',      // idle | planning | running | paused | finished | collapsed
    simulatedTime: null,
    currentDay: 1,
    elapsedSeconds: 0,
    config: { startDate: new Date() },
    simulationId: null,
    collapsedAirportIata: null,
    daysSimulated: 0,
  })

  const [simulationData, setSimulationData] = useState({
    airports: [],
    flights: [],
    shipments: [],
    shipmentCounts: {},
    kpis: {
      onTimeDeliveryPct: 100,
      avgFlightOccupancy: 0,
      avgWarehouseOccupancy: 0,
      totalDelayedBags: 0,
      totalBags: 0,
      deliveredBags: 0,
      inTransitBags: 0,
      waitingBags: 0,
    },
  })

  const [notifications, setNotifications] = useState([])
  const [planningProgress, setPlanningProgress] = useState({
    phase: '', iteration: 0, maxIterations: 1000,
    assignedBatches: 0, totalBatches: 0, currentObjective: 0,
  })
  const [firstBatchReady, setFirstBatchReady] = useState(false)

  const statusRef = useRef('idle')
  const simIdRef = useRef(null)
  const firstBatchReadyRef = useRef(false)
  const shipmentPollRef = useRef(null)

  useEffect(() => { statusRef.current = simulationState.status }, [simulationState.status])

  // ── Smooth 1-second timer ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== 'running') return
      setSimulationState(prev => {
        if (prev.status !== 'running') return prev
        return { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Notification helpers ──────────────────────────────────────────────────
  let notifCounter = useRef(0)
  const addNotification = useCallback((message, type = 'info') => {
    notifCounter.current += 1
    setNotifications(prev => [...prev, {
      id: `clp-notif-${notifCounter.current}-${Date.now()}`,
      message, type, dismissed: false,
    }])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n))
  }, [])

  // ── WebSocket handlers ────────────────────────────────────────────────────
  const handleTickEvent = useCallback((event) => {
    let simTime
    if (event.simulatedIso) {
      simTime = new Date(event.simulatedIso + 'Z')
    } else {
      simTime = new Date()
    }

    if (!firstBatchReadyRef.current) {
      firstBatchReadyRef.current = true
      setFirstBatchReady(true)
    }

    const isCollapsed = event.simulationStatus === 'COLLAPSED'
    const isFinished = event.simulationStatus === 'FINISHED'

    setSimulationState(prev => {
      let nextStatus = prev.status
      if (isCollapsed) nextStatus = 'collapsed'
      else if (isFinished) nextStatus = 'finished'
      else if (prev.status !== 'paused') nextStatus = 'running'

      return {
        ...prev,
        simulatedTime: simTime,
        currentDay: event.simulatedDay || prev.currentDay,
        elapsedSeconds: Math.max(prev.elapsedSeconds, event.elapsedRealSeconds),
        status: nextStatus,
        // Antes: el backend nunca mandaba collapsedIata por WS (ni siquiera
        // existía el campo), así que esto se quedaba en null hasta el próximo
        // refresh manual. Ahora sí llega en el evento COLLAPSED.
        collapsedAirportIata: isCollapsed ? (event.collapsedIata ?? prev.collapsedAirportIata) : prev.collapsedAirportIata,
      }
    })

    setSimulationData(prev => {
      let nextAirports = prev.airports
      if (event.airports) {
        const map = new Map(event.airports.map(x => [x.iata, x]))
        nextAirports = prev.airports.map(a => {
          const u = map.get(a.iata) || map.get(a.iataCode)
          if (!u) return a
          return { ...a, occupancy: u.occupancyPct, currentOccupancy: u.currentOccupancy, semaphoreLevel: u.semaphoreLevel }
        })
      }

      let nextFlights = prev.flights
      if (event.flights) {
        const fMap = new Map(event.flights.map(x => [String(x.flightId), x]))
        const matched = new Set()
        nextFlights = prev.flights.map(f => {
          const u = fMap.get(String(f.id)) || fMap.get(String(f.backendId))
          if (!u) return f
          matched.add(String(u.flightId))
          return {
            ...f, status: u.status, progress: u.progress,
            bagsAboard: u.currentLoad, capacity: u.baggageCapacity || f.capacity,
            departureUTC: u.departureTime || f.departureUTC,
            arrivalUTC: u.arrivalTime || f.arrivalUTC,
            airline: u.airlineName || f.airline,
          }
        })
        const newFlights = event.flights
          .filter(u => !matched.has(String(u.flightId)))
          .map(u => ({
            id: u.flightId, backendId: u.flightId,
            origin: u.originIata, destination: u.destinationIata,
            status: u.status, progress: u.progress,
            bagsAboard: u.currentLoad, capacity: u.baggageCapacity,
            airline: u.airlineName || '—',
            departureUTC: u.departureTime, arrivalUTC: u.arrivalTime,
          }))
        if (newFlights.length) nextFlights = [...nextFlights, ...newFlights]
      }

      const nextKpis = event.kpis ? {
        onTimeDeliveryPct: event.kpis.onTimePct ?? 100,
        avgFlightOccupancy: event.kpis.avgFlightOcc ?? 0,
        avgWarehouseOccupancy: event.kpis.avgWarehouseOcc ?? 0,
        totalDelayedBags: event.delayedBags ?? 0,
        totalBags: event.totalBags ?? prev.kpis.totalBags,
        deliveredBags: event.deliveredBags ?? prev.kpis.deliveredBags,
        inTransitBags: event.inTransitBags ?? prev.kpis.inTransitBags,
        waitingBags: event.waitingBags ?? prev.kpis.waitingBags,
      } : prev.kpis

      return { ...prev, airports: nextAirports, flights: nextFlights, kpis: nextKpis, shipmentCounts: event.shipmentCounts || prev.shipmentCounts }
    })
  }, [])

  const handlePlanProgress = useCallback((snap) => {
    // "WAITING" es el keep-alive que manda el backend mientras el orquestador
    // espera a que termine la planificación en background del siguiente bloque
    // (ver ClpBlockOrchestrator.resolveNextBlock). No trae datos reales de
    // progreso, así que lo ignoramos para no pisar la barra de avance del ALNS.
    if (snap.phase === 'WAITING') return

    setPlanningProgress({
      phase: snap.phase, iteration: snap.iteration,
      maxIterations: snap.maxIterations,
      assignedBatches: snap.assignedBatches,
      totalBatches: snap.totalBatches,
      currentObjective: snap.currentObjective,
    })
    if (snap.phase === 'BLOCK_START') {
      setSimulationState(prev => ({ ...prev, status: 'planning' }))
    }
  }, [])

  const handleAlert = useCallback((alert) => {
    const typeMap = { DELAY: 'warning', CRITICAL_OCCUPANCY: 'error', CANCELLATION: 'error' }
    addNotification(alert.message, typeMap[alert.type] || 'info')
  }, [addNotification])

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const startClpSimulation = useCallback(async (config) => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)

    const startDate = config.startDate instanceof Date ? config.startDate : new Date(config.startDate)

    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
    setNotifications([])

    try {
      const simDto = await clpSimulationApi.create({
        startDate: startDate.toISOString().replace('Z', ''),
        algorithm: config.algorithm || 'ALNS',
        cancellationRate: config.cancellationRate ?? 0.0,
        seed: config.seed ?? 42,
        volumePerDay: config.volumePerDay ?? 10,
      })

      simIdRef.current = simDto.id

      const [realAirports, realFlights] = await Promise.allSettled([
        airportApi.getAll(),
        flightApi.getAll(null, true),
      ])

      const nextAirports = realAirports.status === 'fulfilled'
        ? realAirports.value.map(a => ({
          ...a, iata: a.iata || a.iataCode, iataCode: a.iata || a.iataCode,
          lat: a.latitude, lon: a.longitude, occupancy: a.occupancyPct || 0,
          continent: (!a.continent || a.continent.toLowerCase() === 'unknown') ? 'Sudamérica' : a.continent,
        })) : []

      const nextFlights = realFlights.status === 'fulfilled'
        ? realFlights.value.map(f => ({
          ...f, origin: f.originIata, destination: f.destinationIata,
          departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
          arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
          capacity: f.baggageCapacity, bagsAboard: f.currentLoad,
          airline: f.airlineName || f.airlineIata || '—', backendId: f.id,
        })) : []

      setSimulationData(prev => ({ ...prev, airports: nextAirports, flights: nextFlights }))

      connectSimulationWebSocket(simDto.id, handleTickEvent, handleAlert, handlePlanProgress)
      await clpSimulationApi.start(simDto.id)

      setSimulationState({
        status: 'planning', simulatedTime: startDate, currentDay: 1, elapsedSeconds: 0,
        config: { startDate }, simulationId: simDto.id,
        collapsedAirportIata: null, daysSimulated: 0,
      })

      addNotification('Planificando rutas iniciales para simulación de colapso...', 'info')

    } catch (err) {
      console.error('Error al iniciar simulación Clp:', err.message)
      addNotification('Error al iniciar la simulación de colapso.', 'error')
      setSimulationState(prev => ({ ...prev, status: 'idle' }))
    }
  }, [handleTickEvent, handleAlert, handlePlanProgress, addNotification])

  const pauseSimulation = useCallback(async () => {
    const id = simIdRef.current
    if (id) try { await clpSimulationApi.pause(id) } catch {}
    setSimulationState(prev => ({ ...prev, status: 'paused' }))
  }, [])

  const resumeSimulation = useCallback(async () => {
    const id = simIdRef.current
    if (id) {
      try {
        await clpSimulationApi.resume(id)
        connectSimulationWebSocket(id, handleTickEvent, handleAlert, handlePlanProgress)
      } catch {}
    }
    setSimulationState(prev => ({ ...prev, status: 'running' }))
  }, [handleTickEvent, handleAlert, handlePlanProgress])

  const cancelSimulation = useCallback(async () => {
    const id = simIdRef.current
    disconnectSimulationWebSocket()
    if (shipmentPollRef.current) { clearInterval(shipmentPollRef.current); shipmentPollRef.current = null }
    if (id) try { await clpSimulationApi.stop(id) } catch {}
    simIdRef.current = null
    setSimulationState({
      status: 'idle', simulatedTime: null, currentDay: 1, elapsedSeconds: 0,
      config: { startDate: new Date() }, simulationId: null,
      collapsedAirportIata: null, daysSimulated: 0,
    })
    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
  }, [])

  const resetSimulation = useCallback(() => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    simIdRef.current = null
    setSimulationState({
      status: 'idle', simulatedTime: null, currentDay: 1, elapsedSeconds: 0,
      config: { startDate: new Date() }, simulationId: null,
      collapsedAirportIata: null, daysSimulated: 0,
    })
    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
  }, [])

  // Auto-reconnect on mount
  useEffect(() => {
    async function reconnect() {
      try {
        const active = await clpSimulationApi.getActive()
        if (!active) return
        simIdRef.current = active.id
        const simTime = active.simulatedTime ? new Date(active.simulatedTime) : new Date(active.startDate)
        const frontendStatus = active.status === 'PLAYING' ? 'running'
          : active.status === 'BUFFERING' ? 'planning'
          : active.status === 'FINISHED' ? (active.collapsedAt ? 'collapsed' : 'finished')
          : 'paused'

        setSimulationState({
          status: frontendStatus, simulatedTime: simTime,
          currentDay: active.daysSimulated || 1, elapsedSeconds: 0,
          config: { startDate: new Date(active.startDate) },
          simulationId: active.id,
          collapsedAirportIata: active.collapsedAirportIata || null,
          daysSimulated: active.daysSimulated || 0,
        })

        const [realAirports] = await Promise.allSettled([airportApi.getAll()])
        if (realAirports.status === 'fulfilled') {
          setSimulationData(prev => ({
            ...prev,
            airports: realAirports.value.map(a => ({
              ...a, iata: a.iata || a.iataCode, iataCode: a.iata || a.iataCode,
              lat: a.latitude, lon: a.longitude, occupancy: a.occupancyPct || 0,
              continent: (!a.continent || a.continent.toLowerCase() === 'unknown') ? 'Sudamérica' : a.continent,
            })),
          }))
        }

        if (['PLAYING', 'BUFFERING', 'PAUSED'].includes(active.status)) {
          connectSimulationWebSocket(active.id, handleTickEvent, handleAlert, handlePlanProgress)
          firstBatchReadyRef.current = true
          setFirstBatchReady(true)
        }
      } catch {}
    }
    reconnect()
  }, [handleTickEvent, handleAlert, handlePlanProgress])

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
    firstBatchReady,
    startClpSimulation,
    pauseSimulation,
    resumeSimulation,
    cancelSimulation,
    resetSimulation,
    addNotification,
    dismissNotification,
  }
}