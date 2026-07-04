import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { clpSimulationApi } from '../api/clpSimulationApi'
import { airportApi, flightApi, shipmentApi } from '../api/simulationApi'
import { connectSimulationWebSocket, disconnectSimulationWebSocket } from '../websocket/simulationWebSocket'
import { createLogger } from '../utils/logger'

const simLogger = createLogger('ClpSimulation-Frontend')

/**
 * Hook for the Collapse (Clp) simulation scenario.
 * Mirrors useSimulation (5D) tick-event interface but calls /api/clp/simulations.
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
  const [bellUnreadCount, setBellUnreadCount] = useState(0)
  const [planningProgress, setPlanningProgress] = useState({
    phase: '', iteration: 0, maxIterations: 1000,
    assignedBatches: 0, totalBatches: 0, currentObjective: 0,
  })
  const [blockHistory, setBlockHistory] = useState([])
  const [totalSimBlocks, setTotalSimBlocks] = useState(0)
  const [firstBatchReady, setFirstBatchReady] = useState(false)

  const statusRef = useRef('idle')
  const simIdRef = useRef(null)
  const simTimeRef = useRef(null)
  const firstBatchReadyRef = useRef(false)
  const shipmentPollRef = useRef(null)
  const flightPollRef = useRef(null)
  const postPlanningLoadRef = useRef(false)

  // Refs for smooth 60fps plane interpolation between WebSocket ticks
  const lastTickSimTimeRef = useRef(null)
  const lastTickRealTimeRef = useRef(null)
  const simMsPerRealMsRef = useRef(null)
  const animClockRef = useRef({ lastTickSimTime: null, lastTickRealTime: null, simMsPerRealMs: null })

  useEffect(() => {
    statusRef.current = simulationState.status
    simTimeRef.current = simulationState.simulatedTime
  }, [simulationState.status, simulationState.simulatedTime])

  // ── Smooth 1-second timer (mirrors 5D exactly) ────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== 'running') return
      setSimulationState(prev => {
        if (prev.status !== 'running') return prev

        let newSimTime = prev.simulatedTime ? new Date(prev.simulatedTime.getTime()) : new Date()
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

  // ── Post-planning flight reload (mirrors 5D) ─────────────────────────────
  useEffect(() => {
    if (simulationState.status !== 'running') {
      postPlanningLoadRef.current = false
      return
    }
    if (postPlanningLoadRef.current) return
    postPlanningLoadRef.current = true
    flightApi.getAll(null, true).then(flights => {
      if (!Array.isArray(flights) || flights.length === 0) return
      setSimulationData(prev => ({
        ...prev,
        flights: flights.map(f => ({
          ...f,
          origin: f.originIata,
          destination: f.destinationIata,
          departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
          arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
          capacity: f.baggageCapacity,
          bagsAboard: f.currentLoad,
          airline: f.airlineName || f.airlineIata || '—',
          backendId: f.id,
        })),
      }))
    }).catch(() => {})
  }, [simulationState.status])

  // ── Periodic IN_FLIGHT refresh (mirrors 5D) ──────────────────────────────
  const refreshInFlightFlights = useCallback(async () => {
    if (statusRef.current !== 'running') return
    try {
      const inFlightList = await flightApi.getAll('IN_FLIGHT', true)
      if (!Array.isArray(inFlightList) || inFlightList.length === 0) return

      setSimulationData(prev => {
        const apiMap = new Map(inFlightList.map(f => [String(f.id), f]))
        const updated = prev.flights.map(f => {
          const apiF = apiMap.get(String(f.id)) || apiMap.get(String(f.backendId))
          if (!apiF) return f
          apiMap.delete(String(apiF.id))
          return { ...f, status: 'IN_FLIGHT', bagsAboard: apiF.currentLoad, capacity: apiF.baggageCapacity || f.capacity }
        })
        const existingIds = new Set(prev.flights.map(f => String(f.id || f.backendId)))
        const appended = inFlightList
          .filter(f => !existingIds.has(String(f.id)))
          .map(f => ({
            ...f,
            origin: f.originIata, destination: f.destinationIata,
            departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
            arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
            capacity: f.baggageCapacity, bagsAboard: f.currentLoad,
            airline: f.airlineName || f.airlineIata || '—', backendId: f.id,
          }))
        if (appended.length === 0 && !updated.some((f, i) => f !== prev.flights[i])) return prev
        return { ...prev, flights: appended.length > 0 ? [...updated, ...appended] : updated }
      })
    } catch (e) { simLogger.warn('refreshInFlightFlights error: ' + e.message) }
  }, [])

  // ── Periodic shipment loader (mirrors 5D) ─────────────────────────────────
  const loadShipments = useCallback(async () => {
    try {
      const sms = await shipmentApi.getAll()
      if (Array.isArray(sms)) {
        setSimulationData(prev => {
          let totalBags = 0, waitingBags = 0, inTransitBags = 0, deliveredBags = 0
          const shipmentCounts = {}
          const shipments = sms.map(s => {
            const qty = s.quantity || 0
            totalBags += qty
            if (s.status === 'IN_ORIGIN') waitingBags += qty
            if (s.status === 'IN_TRANSIT') inTransitBags += qty
            if (s.status === 'DELIVERED') deliveredBags += qty
            shipmentCounts[s.status] = (shipmentCounts[s.status] || 0) + 1
            return {
              id: s.id, status: s.status,
              origin: s.originIata || '—', destination: s.destinationIata || '—',
              totalBags: qty, deliveredBags: s.status === 'DELIVERED' ? qty : 0,
              client: s.airline || '—', currentFlight: null, deliveredAt: s.deliveredAt || null,
            }
          })
          return {
            ...prev, shipments, shipmentCounts,
            kpis: {
              ...prev.kpis,
              totalBags: prev.kpis.totalBags === 0 ? totalBags : prev.kpis.totalBags,
              waitingBags: prev.kpis.totalBags === 0 ? waitingBags : prev.kpis.waitingBags,
              inTransitBags: prev.kpis.totalBags === 0 ? inTransitBags : prev.kpis.inTransitBags,
              deliveredBags: prev.kpis.totalBags === 0 ? deliveredBags : prev.kpis.deliveredBags,
            },
          }
        })
      }
    } catch (e) { simLogger.warn('loadShipments error: ' + e.message) }
  }, [])

  // ── Notification helpers ──────────────────────────────────────────────────
  let notifCounter = useRef(0)
  const addNotification = useCallback((message, type = 'info') => {
    notifCounter.current += 1
    setNotifications(prev => [...prev, {
      id: `clp-notif-${notifCounter.current}-${Date.now()}`,
      message, type, dismissed: false,
    }])
    setBellUnreadCount(prev => prev + 1)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n))
  }, [])

  const markBellRead = useCallback(() => { setBellUnreadCount(0) }, [])

  // ── WebSocket tick handler (mirrors 5D + collapse detection) ──────────────
  const handleTickEvent = useCallback((event) => {
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
    const realDeltaMs = lastTickRealTimeRef.current ? now - lastTickRealTimeRef.current : null
    if (lastTickSimTimeRef.current && realDeltaMs != null) {
      const simDeltaMs = simTime.getTime() - lastTickSimTimeRef.current.getTime()
      if (realDeltaMs > 500 && simDeltaMs > 0) {
        simMsPerRealMsRef.current = simDeltaMs / realDeltaMs
      }
    }

    simLogger.info(
      `[TICK] day=${event.simulatedDay} t=${event.simulatedTime}` +
      ` | realInterval=${realDeltaMs != null ? realDeltaMs.toFixed(0) + 'ms' : 'first'}` +
      ` | flights=${event.flights?.length ?? 0} airports=${event.airports?.length ?? 0}` +
      ` | backendElapsed=${event.elapsedRealSeconds}s`
    )

    lastTickSimTimeRef.current = simTime
    lastTickRealTimeRef.current = now
    animClockRef.current = {
      lastTickSimTime: simTime,
      lastTickRealTime: now,
      simMsPerRealMs: simMsPerRealMsRef.current,
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
      else if (prev.status !== 'paused' && prev.status !== 'finished') nextStatus = 'running'

      return {
        ...prev,
        simulatedTime: simTime,
        currentDay: event.simulatedDay || prev.currentDay,
        elapsedSeconds: Math.max(prev.elapsedSeconds, event.elapsedRealSeconds),
        status: nextStatus,
        collapsedAirportIata: isCollapsed ? (event.collapsedIata ?? prev.collapsedAirportIata) : prev.collapsedAirportIata,
      }
    })

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
        const flightUpdateMap = new Map(event.flights.map(x => [String(x.flightId), x]))
        const matchedIds = new Set()
        nextFlights = prev.flights.map(f => {
          const update = flightUpdateMap.get(String(f.id)) || flightUpdateMap.get(String(f.backendId))
          if (!update) return f
          matchedIds.add(String(update.flightId))
          return {
            ...f, status: update.status, progress: update.progress,
            bagsAboard: update.currentLoad, capacity: update.baggageCapacity || f.capacity,
            departureUTC: update.departureTime || f.departureUTC,
            arrivalUTC: update.arrivalTime || f.arrivalUTC,
            airline: update.airlineName || f.airline,
            fromTick: true,
          }
        })
        const newFlights = []
        for (const [fId, update] of flightUpdateMap) {
          if (matchedIds.has(fId)) continue
          newFlights.push({
            id: update.flightId, backendId: update.flightId,
            origin: update.originIata, destination: update.destinationIata,
            status: update.status, progress: update.progress,
            bagsAboard: update.currentLoad, capacity: update.baggageCapacity,
            airline: update.airlineName || '—',
            departureUTC: update.departureTime, arrivalUTC: update.arrivalTime,
            fromTick: true,
          })
        }
        if (newFlights.length > 0) nextFlights = [...nextFlights, ...newFlights]
      }

      const nextKpis = event.kpis ? {
        onTimeDeliveryPct: event.kpis.onTimePct ?? 100,
        avgFlightOccupancy: event.kpis.avgFlightOcc ?? 0,
        avgWarehouseOccupancy: event.kpis.avgWarehouseOcc ?? 0,
        totalDelayedBags: event.delayedBags ?? 0,
        totalBags: event.totalBags ?? prev.kpis.totalBags ?? 0,
        deliveredBags: event.deliveredBags ?? prev.kpis.deliveredBags ?? 0,
        inTransitBags: event.inTransitBags ?? prev.kpis.inTransitBags ?? 0,
        waitingBags: event.waitingBags ?? prev.kpis.waitingBags ?? 0,
      } : prev.kpis

      return {
        ...prev,
        airports: nextAirports,
        flights: nextFlights,
        kpis: nextKpis,
        shipmentCounts: event.shipmentCounts || prev.shipmentCounts,
      }
    })
  }, [])

  // ── Plan progress handler (mirrors 5D + WAITING skip) ─────────────────────
  const handlePlanProgress = useCallback((snap) => {
    if (snap.phase === 'WAITING') return

    if (snap.phase === 'BLOCK_START') {
      setPlanningProgress(prev => ({
        ...prev,
        phase: `Planificando día ${snap.assignedBatches + 1} de ${snap.totalBatches}`,
        iteration: 0, maxIterations: snap.totalBatches,
        assignedBatches: snap.assignedBatches, totalBatches: snap.totalBatches,
      }))
      setSimulationState(prev => ({ ...prev, status: 'planning' }))
      setTotalSimBlocks(snap.totalBlocks || snap.totalBatches)
      setBlockHistory(prev => [
        ...prev.map(b => b.status === 'active' ? { ...b, status: 'done' } : b),
        {
          blockIndex: snap.blockIndex ?? snap.assignedBatches,
          totalBlocks: snap.totalBlocks || snap.totalBatches,
          windowStart: snap.blockWindowStart || null,
          windowEnd: snap.blockWindowEnd || null,
          assignedBatches: 0, totalBatches: 0, status: 'active',
        },
      ])
      return
    }

    const newStatus = snap.phase === 'COMPLETE' ? 'done' : 'active'
    const blockIdx = snap.blockIndex ?? -1

    setBlockHistory(prev => {
      const byIndex = blockIdx >= 0 ? prev.find(b => b.blockIndex === blockIdx) : null
      if (byIndex) {
        return prev.map(b => b.blockIndex === blockIdx
          ? { ...b, assignedBatches: snap.assignedBatches, totalBatches: snap.totalBatches, status: newStatus }
          : b
        )
      }
      if (blockIdx >= 0 && snap.blockWindowStart) {
        return [
          ...prev.map(b => b.status === 'active' ? { ...b, status: 'done' } : b),
          {
            blockIndex: blockIdx,
            totalBlocks: snap.totalBlocks || 0,
            windowStart: snap.blockWindowStart || null,
            windowEnd: snap.blockWindowEnd || null,
            assignedBatches: snap.assignedBatches,
            totalBatches: snap.totalBatches,
            status: newStatus,
          },
        ]
      }
      return prev.map(b => b.status === 'active'
        ? { ...b, assignedBatches: snap.assignedBatches, totalBatches: snap.totalBatches, status: newStatus }
        : b
      )
    })

    if (snap.totalBlocks > 0) setTotalSimBlocks(snap.totalBlocks)

    setPlanningProgress({
      phase: snap.phase, iteration: snap.iteration,
      maxIterations: snap.maxIterations,
      assignedBatches: snap.assignedBatches,
      totalBatches: snap.totalBatches,
      currentObjective: snap.currentObjective,
    })
  }, [])

  const handleAlert = useCallback((alert) => {
    const typeMap = { DELAY: 'warning', CRITICAL_OCCUPANCY: 'error', CANCELLATION: 'error', COLLAPSE: 'error' }
    addNotification(alert.message, typeMap[alert.type] || 'info')
  }, [addNotification])

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const startClpSimulation = useCallback(async (config) => {
    notifCounter.current = 0
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    setBlockHistory([])
    setTotalSimBlocks(0)

    const startDate = config.startDate instanceof Date
      ? config.startDate
      : (config.startDate && config.startDate.toDate ? config.startDate.toDate() : new Date(config.startDate))
    const simStart = new Date(startDate)
    simTimeRef.current = simStart
    statusRef.current = 'running'

    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
    setNotifications([])
    setBellUnreadCount(0)

    try {
      const simDto = await clpSimulationApi.create({
        startDate: simStart.toISOString().replace('Z', ''),
        algorithm: config.algorithm || 'ALNS',
        cancellationRate: config.cancellationRate ?? 0.0,
        seed: config.seed ?? 42,
        volumePerDay: config.volumePerDay ?? 10,
      })

      simIdRef.current = simDto.id
      simLogger.info(`Simulación Clp backend creada. ID: ${simDto.id}`)

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

      // Subscribe BEFORE start() so planning events are not missed
      connectSimulationWebSocket(simDto.id, handleTickEvent, handleAlert, handlePlanProgress)
      await clpSimulationApi.start(simDto.id)

      setSimulationState({
        status: 'planning', simulatedTime: simStart, currentDay: 1, elapsedSeconds: 0,
        config: { startDate: simStart }, simulationId: simDto.id,
        collapsedAirportIata: null, daysSimulated: 0,
      })

      addNotification('Planificando rutas iniciales para simulación de colapso...', 'info')

      await loadShipments()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      shipmentPollRef.current = setInterval(loadShipments, 5000)
      if (flightPollRef.current) clearInterval(flightPollRef.current)
      flightPollRef.current = setInterval(refreshInFlightFlights, 5000)

    } catch (err) {
      simLogger.error('Error al iniciar simulación Clp:', err.message)
      addNotification('Error al iniciar la simulación de colapso.', 'error')
      statusRef.current = 'idle'
      setSimulationState(prev => ({ ...prev, status: 'idle' }))
    }
  }, [handleTickEvent, handleAlert, handlePlanProgress, addNotification, loadShipments, refreshInFlightFlights])

  const pauseSimulation = useCallback(async () => {
    const id = simIdRef.current
    if (id) try { await clpSimulationApi.pause(id) } catch (e) { console.error(e) }
    statusRef.current = 'paused'
    setSimulationState(prev => ({ ...prev, status: 'paused' }))
    addNotification('Simulación pausada.', 'info')
  }, [addNotification])

  const resumeSimulation = useCallback(async () => {
    if (statusRef.current !== 'paused') return
    const id = simIdRef.current
    if (id) {
      try {
        await clpSimulationApi.resume(id)
        connectSimulationWebSocket(id, handleTickEvent, handleAlert, handlePlanProgress)
      } catch (e) { console.error(e) }
    }
    statusRef.current = 'running'
    setSimulationState(prev => ({ ...prev, status: 'running' }))
    addNotification('Simulación reanudada.', 'info')
  }, [handleTickEvent, handleAlert, handlePlanProgress, addNotification])

  const cancelSimulation = useCallback(async () => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    const id = simIdRef.current
    disconnectSimulationWebSocket()
    if (shipmentPollRef.current) { clearInterval(shipmentPollRef.current); shipmentPollRef.current = null }
    if (flightPollRef.current) { clearInterval(flightPollRef.current); flightPollRef.current = null }
    if (id) try { await clpSimulationApi.stop(id) } catch (e) { console.error(e) }
    simIdRef.current = null
    statusRef.current = 'idle'
    setSimulationState({
      status: 'idle', simulatedTime: null, currentDay: 1, elapsedSeconds: 0,
      config: { startDate: new Date() }, simulationId: null,
      collapsedAirportIata: null, daysSimulated: 0,
    })
    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
    setNotifications([])
    setBellUnreadCount(0)
  }, [])

  const resetSimulation = useCallback(() => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    simIdRef.current = null
    statusRef.current = 'idle'
    setSimulationState({
      status: 'idle', simulatedTime: null, currentDay: 1, elapsedSeconds: 0,
      config: { startDate: new Date() }, simulationId: null,
      collapsedAirportIata: null, daysSimulated: 0,
    })
    setSimulationData({
      airports: [], flights: [], shipments: [], shipmentCounts: {},
      kpis: { onTimeDeliveryPct: 100, avgFlightOccupancy: 0, avgWarehouseOccupancy: 0, totalDelayedBags: 0, totalBags: 0, deliveredBags: 0, inTransitBags: 0, waitingBags: 0 },
    })
    setNotifications([])
    setBellUnreadCount(0)
  }, [])

  // ── Auto-reconnect on mount (mirrors 5D attachToSimulation) ───────────────
  const attachToSimulation = useCallback(async (active) => {
    try {
      simIdRef.current = active.id
      const simTime = active.simulatedTime ? new Date(active.simulatedTime) : new Date(active.startDate)
      simTimeRef.current = simTime
      const frontendStatus = active.status === 'PLAYING' ? 'running'
        : active.status === 'BUFFERING' ? 'planning'
        : active.status === 'FINISHED' ? (active.collapsedAt ? 'collapsed' : 'finished')
        : 'paused'
      statusRef.current = frontendStatus

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

      if (frontendStatus !== 'planning') {
        firstBatchReadyRef.current = true
        setFirstBatchReady(true)
      }

      let currentDay = 1
      if (active.simulatedTime && active.startDate) {
        const start = new Date(active.startDate)
        start.setUTCHours(0, 0, 0, 0)
        const current = new Date(active.simulatedTime)
        currentDay = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }

      setSimulationState({
        status: frontendStatus, simulatedTime: simTime,
        currentDay, elapsedSeconds: 0,
        config: { startDate: new Date(active.startDate) },
        simulationId: active.id,
        collapsedAirportIata: active.collapsedAirportIata || null,
        daysSimulated: active.daysSimulated || 0,
      })

      await loadShipments()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      shipmentPollRef.current = setInterval(loadShipments, 5000)
      if (flightPollRef.current) clearInterval(flightPollRef.current)
      flightPollRef.current = setInterval(refreshInFlightFlights, 5000)

      if (['PLAYING', 'BUFFERING', 'PAUSED'].includes(active.status)) {
        connectSimulationWebSocket(active.id, handleTickEvent, handleAlert, handlePlanProgress)
      }

      simLogger.info(`Enganchado a simulación Clp ID=${active.id}, estado=${active.status}`)
    } catch (e) {
      simLogger.warn('attachToSimulation error: ' + (e?.message ?? e))
    }
  }, [handleTickEvent, handleAlert, handlePlanProgress, loadShipments, refreshInFlightFlights])

  useEffect(() => {
    async function reconnect() {
      try {
        const active = await clpSimulationApi.getActive()
        if (!active) return
        await attachToSimulation(active)
      } catch {}
    }
    reconnect()
  }, [attachToSimulation])

  useEffect(() => {
    return () => {
      disconnectSimulationWebSocket()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      if (flightPollRef.current) clearInterval(flightPollRef.current)
    }
  }, [])

  return {
    simulationState,
    ...simulationData,
    notifications,
    bellUnreadCount,
    markBellRead,
    planningProgress,
    blockHistory,
    totalSimBlocks,
    firstBatchReady,
    animClockRef,
    startClpSimulation,
    pauseSimulation,
    resumeSimulation,
    cancelSimulation,
    resetSimulation,
    attachToSimulation,
    addNotification,
    dismissNotification,
  }
}
