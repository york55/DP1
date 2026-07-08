import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
    currentDay: 1,
    elapsedSeconds: 0,
    config: { period: 5, startDate: new Date() },
    simulationId: null,
  })

  // Group dynamic data to reduce renders
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
    }
  })

  // Panel, Selection and Filtering Shared State
  const [selectedAirportCode, setSelectedAirportCode] = useState(null)
  const [selectedFlightId, setSelectedFlightId] = useState(null)
  const [selectedShipmentId, setSelectedShipmentId] = useState(null)
  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState(null)
  const [shipmentRouteLoading, setShipmentRouteLoading] = useState(false)
  const [activePanelTab, setActivePanelTab] = useState(0)

  const [warehouseSearch, setWarehouseSearch] = useState('')
  const [warehouseRegion, setWarehouseRegion] = useState('ALL')
  const [warehouseSemaphore, setWarehouseSemaphore] = useState('ALL')

  const [flightSearch, setFlightSearch] = useState('')
  const [flightOrigin, setFlightOrigin] = useState('ALL')
  const [flightDest, setFlightDest] = useState('ALL')
  const [flightSemaphore, setFlightSemaphore] = useState('ALL')

  const [notifications, setNotifications] = useState([])
  const [bellUnreadCount, setBellUnreadCount] = useState(0)

  const [planningProgress, setPlanningProgress] = useState({
    phase: '',
    iteration: 0,
    maxIterations: 1000,
    assignedBatches: 0,
    totalBatches: 0,
    currentObjective: 0,
  })

  // blockHistory: array of { blockIndex, totalBlocks, windowStart, windowEnd, assignedBatches, totalBatches, status }
  const [blockHistory, setBlockHistory] = useState([])
  const [totalSimBlocks, setTotalSimBlocks] = useState(0)

  const [firstBatchReady, setFirstBatchReady] = useState(false)
  const firstBatchReadyRef = useRef(false)

  const simTimeRef = useRef(null)
  const statusRef = useRef('idle')
  const simIdRef = useRef(null)
  const shipmentPollRef = useRef(null)
  const flightPollRef = useRef(null)
  const postPlanningLoadRef = useRef(false)

  // Refs for smooth timer interpolation between ticks
  const lastTickSimTimeRef = useRef(null)
  const lastTickRealTimeRef = useRef(null)
  const simMsPerRealMsRef = useRef(null)
  // Stable ref exposed to PlaneCanvasLayer for 60fps rAF animation
  const animClockRef = useRef({ lastTickSimTime: null, lastTickRealTime: null, simMsPerRealMs: null })

  useEffect(() => {
    simTimeRef.current = simulationState.simulatedTime
    statusRef.current = simulationState.status
  }, [simulationState.simulatedTime, simulationState.status])

  // After ALNS planning completes the status flips to 'running' on the first tick.
  // Re-fetch assigned flights once at that moment because the initial load fires
  // before start() is called — no RouteLeg records exist yet at that point.
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

  // Smooth 1-second timer: increments elapsedSeconds every real second and
  // interpolates simulatedTime between WebSocket ticks so neither jumps.
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

  // Periodically fetch IN_FLIGHT flights from the REST API and merge them into state.
  // This is the same thing reconnect() does on F5 — it catches flights that became
  // IN_FLIGHT via processDepartures even when planning produced no route legs (so the
  // WebSocket tick query never includes them).
  const refreshInFlightFlights = useCallback(async () => {
    if (statusRef.current !== 'running') return
    try {
      const inFlightList = await flightApi.getAll('IN_FLIGHT', true)
      if (!Array.isArray(inFlightList) || inFlightList.length === 0) return

      setSimulationData(prev => {
        const apiMap = new Map(inFlightList.map(f => [String(f.id), f]))

        // Update existing flights whose status is now IN_FLIGHT
        const updated = prev.flights.map(f => {
          const apiF = apiMap.get(String(f.id)) || apiMap.get(String(f.backendId))
          if (!apiF) return f
          apiMap.delete(String(apiF.id)) // mark as matched
          return { ...f, status: 'IN_FLIGHT', bagsAboard: apiF.currentLoad, capacity: apiF.baggageCapacity || f.capacity }
        })

        // Append any IN_FLIGHT flights that weren't in the initial load at all
        const existingIds = new Set(prev.flights.map(f => String(f.id || f.backendId)))
        const appended = inFlightList
          .filter(f => !existingIds.has(String(f.id)))
          .map(f => ({
            ...f,
            origin: f.originIata,
            destination: f.destinationIata,
            departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
            arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
            capacity: f.baggageCapacity,
            bagsAboard: f.currentLoad,
            airline: f.airlineName || f.airlineIata || '—',
            backendId: f.id,
          }))

        if (appended.length === 0 && !updated.some((f, i) => f !== prev.flights[i])) return prev
        return { ...prev, flights: appended.length > 0 ? [...updated, ...appended] : updated }
      })
    } catch (e) { simLogger.warn('refreshInFlightFlights error: ' + e.message) }
  }, [])

  const loadShipments = useCallback(async () => {
    try {
      const sms = await shipmentApi.getAll()
      if (Array.isArray(sms)) {
        setSimulationData(prev => {
          let totalBags = 0
          let waitingBags = 0
          let inTransitBags = 0
          let deliveredBags = 0
          const shipmentCounts = {}

          const shipments = sms.map(s => {
            const qty = s.quantity || 0
            totalBags += qty
            if (s.status === 'IN_ORIGIN') waitingBags += qty
            if (s.status === 'IN_TRANSIT') inTransitBags += qty
            if (s.status === 'DELIVERED') deliveredBags += qty

            shipmentCounts[s.status] = (shipmentCounts[s.status] || 0) + 1

            return {
              id: s.id,
              status: s.status,
              origin: s.originIata || '—',
              destination: s.destinationIata || '—',
              totalBags: qty,
              deliveredBags: s.status === 'DELIVERED' ? qty : 0,
              client: s.airline || '—',
              currentFlight: null,
              deliveredAt: s.deliveredAt || null,
            }
          })

          return {
            ...prev,
            shipments,
            shipmentCounts,
            kpis: {
              ...prev.kpis,
              totalBags: prev.kpis.totalBags === 0 ? totalBags : prev.kpis.totalBags,
              waitingBags: prev.kpis.totalBags === 0 ? waitingBags : prev.kpis.waitingBags,
              inTransitBags: prev.kpis.totalBags === 0 ? inTransitBags : prev.kpis.inTransitBags,
              deliveredBags: prev.kpis.totalBags === 0 ? deliveredBags : prev.kpis.deliveredBags,
            }
          }
        })
      }
    } catch (e) { simLogger.warn('loadShipments error: ' + e.message) }
  }, [])

  // Búsqueda a demanda: trae los tramos de un envío y los deja listos para
  // dibujarse en el mapa. clearShipmentRoute() regresa el mapa a su estado anterior.
  const fetchShipmentRoute = useCallback(async (shipmentId) => {
    setShipmentRouteLoading(true)
    try {
      const legs = await shipmentApi.getRoute(shipmentId)
      setSelectedShipmentRoute({ shipmentId, legs })
    } catch (e) {
      simLogger.warn('fetchShipmentRoute error: ' + e.message)
      setSelectedShipmentRoute(null)
    } finally {
      setShipmentRouteLoading(false)
    }
  }, [])

  const clearShipmentRoute = useCallback(() => {
    setSelectedShipmentRoute(null)
  }, [])

  const addNotification = useCallback((message, type = 'info') => {
    setNotifications(prev => [...prev, makeNotification(message, type, false)])
    setBellUnreadCount(prev => prev + 1)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n))
  }, [])

  const markBellRead = useCallback(() => {
    setBellUnreadCount(0)
  }, [])

  // Handle WebSocket tick events from backend
  const handleTickEvent = useCallback((event) => {
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
      ` | simRatio=${simMsPerRealMsRef.current != null ? (simMsPerRealMsRef.current * 1000).toFixed(0) + 'ms-sim/s-real' : 'n/a'}` +
      ` | flights=${event.flights?.length ?? 0} airports=${event.airports?.length ?? 0}` +
      ` | backendElapsed=${event.elapsedRealSeconds}s`
    )

    lastTickSimTimeRef.current = simTime
    animClockRef.current = { lastTickSimTime: simTime, lastTickRealTime: now, simMsPerRealMs: simMsPerRealMsRef.current }
    lastTickRealTimeRef.current = now

    if (!firstBatchReadyRef.current) {
      firstBatchReadyRef.current = true
      setFirstBatchReady(true)
    }

    // Update state — use Math.max so the locally-running timer never goes backward
    setSimulationState(prev => {
      let nextStatus = prev.status;
      if (prev.status !== 'paused' && prev.status !== 'finished') {
        nextStatus = event.simulationStatus === 'FINISHED' ? 'finished' : 'running';
      }

      return {
        ...prev,
        simulatedTime: simTime,
        currentDay: event.simulatedDay || prev.currentDay || 1,
        elapsedSeconds: Math.max(prev.elapsedSeconds, event.elapsedRealSeconds),
        status: nextStatus,
      };
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
            ...f,
            status: update.status,
            progress: update.progress,
            bagsAboard: update.currentLoad,
            capacity: update.baggageCapacity || f.capacity,
            departureUTC: update.departureTime || f.departureUTC,
            arrivalUTC: update.arrivalTime || f.arrivalUTC,
            airline: update.airlineName || f.airline,
            fromTick: true,
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
            fromTick: true,
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
        shipmentCounts: event.shipmentCounts || prev.shipmentCounts || {},
      }
    })
  }, [])

  const handlePlanProgress = useCallback((snap) => {
    simLogger.info(
      `[PLAN] phase="${snap.phase}" iter=${snap.iteration}/${snap.maxIterations}` +
      ` batches=${snap.assignedBatches}/${snap.totalBatches}` +
      ` obj=${snap.currentObjective != null ? snap.currentObjective.toFixed(2) : 'n/a'}`
    )
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
      setTotalSimBlocks(snap.totalBlocks || snap.totalBatches)
      setBlockHistory(prev => [
        ...prev.map(b => b.status === 'active' ? { ...b, status: 'done' } : b),
        {
          blockIndex: snap.blockIndex ?? snap.assignedBatches,
          totalBlocks: snap.totalBlocks || snap.totalBatches,
          windowStart: snap.blockWindowStart || null,
          windowEnd: snap.blockWindowEnd || null,
          assignedBatches: 0,
          totalBatches: 0,
          status: 'active',
        },
      ])
      return
    }
    const newStatus = snap.phase === 'COMPLETE' ? 'done' : 'active'
    const blockIdx = snap.blockIndex ?? -1

    setBlockHistory(prev => {
      // Find existing entry by blockIndex (background blocks never fire BLOCK_START)
      const byIndex = blockIdx >= 0 ? prev.find(b => b.blockIndex === blockIdx) : null

      if (byIndex) {
        return prev.map(b => b.blockIndex === blockIdx
          ? { ...b, assignedBatches: snap.assignedBatches, totalBatches: snap.totalBatches, status: newStatus }
          : b
        )
      }

      // No entry yet for this blockIndex — background block started without BLOCK_START
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

      // Fallback: update any active block by status
      return prev.map(b => b.status === 'active'
        ? { ...b, assignedBatches: snap.assignedBatches, totalBatches: snap.totalBatches, status: newStatus }
        : b
      )
    })

    if (snap.totalBlocks > 0) setTotalSimBlocks(snap.totalBlocks)

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
    addNotification(alert.message, typeMap[alert.type] || 'info')
  }, [addNotification])

  const startSimulation = useCallback(async (config) => {
    notifCounter = 0
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    setBlockHistory([])
    setTotalSimBlocks(0)
    setSelectedAirportCode(null)
    setSelectedFlightId(null)
    setSelectedShipmentId(null)

    const startDate = config.startDate instanceof Date
      ? config.startDate
      : (config.startDate && config.startDate.toDate ? config.startDate.toDate() : new Date(config.startDate))
    const simStart = new Date(startDate)
    simTimeRef.current = simStart
    statusRef.current = 'running'

    setSimulationData({
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
      }
    })
    setNotifications([])
    setBellUnreadCount(0)

    try {
      const simDto = await simulationApi.create({
        scenarioType: 'PERIOD',
        periodDays: config.period,
        startDate: simStart.toISOString().replace('Z', ''),
        algorithm: config.algorithm || 'ALNS',
        cancellationRate: config.cancellationRate ?? 0.0,
        seed: config.seed ?? 42,
        volumePerDay: config.volumePerDay ?? 10,
      })

      simIdRef.current = simDto.id
      simLogger.info(`Simulación backend creada satisfactoriamente. ID: ${simDto.id}`)

      const [realAirports, realFlights] = await Promise.allSettled([
        airportApi.getAll(),
        flightApi.getAll(null, true),
      ])

      const nextAirports = realAirports.status === 'fulfilled'
        ? realAirports.value.map(a => ({
          ...a,
          iata: a.iata || a.iataCode,
          iataCode: a.iata || a.iataCode,
          lat: a.latitude,
          lon: a.longitude,
          occupancy: a.occupancyPct || 0,
          // TODO: fix continent in DB — temporary patch for airports returning 'unknown'
          continent: (!a.continent || a.continent.toLowerCase() === 'unknown') ? 'Sudamérica' : a.continent,
        }))
        : []

      const nextFlights = realFlights.status === 'fulfilled'
        ? realFlights.value.map(f => ({
          ...f,
          origin: f.originIata,
          destination: f.destinationIata,
          departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
          arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
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

      // Subscribe to WebSocket BEFORE calling start() so that BLOCK_START and
      // ALNS progress events are not missed during the planning phase.
      connectSimulationWebSocket(simDto.id, handleTickEvent, handleAlert, handlePlanProgress)
      await simulationApi.start(simDto.id)

      setSimulationState({
        status: 'planning',
        simulatedTime: simStart,
        currentDay: 1,
        elapsedSeconds: 0,
        config: { period: config.period, startDate: simStart },
        simulationId: simDto.id,
      })

      addNotification('Planificando rutas en segundo plano, la simulación iniciará en breve...', 'info')

      await loadShipments()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      shipmentPollRef.current = setInterval(loadShipments, 5000)
      if (flightPollRef.current) clearInterval(flightPollRef.current)
      flightPollRef.current = setInterval(refreshInFlightFlights, 5000)
    } catch (err) {
      simLogger.error('Error al iniciar simulación:', err.message)
      console.warn('[useSimulation] Backend no disponible:', err.message)
      addNotification('Error al iniciar la simulación. Revisa la conexión con el backend.', 'error')
      statusRef.current = 'idle'
      setSimulationState(prev => ({ ...prev, status: 'idle' }))
    }
  }, [handleTickEvent, handleAlert, addNotification, loadShipments, refreshInFlightFlights])

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

  const resetSimulation = useCallback(() => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    setSelectedAirportCode(null)
    setSelectedFlightId(null)
    setSelectedShipmentId(null)
    setSimulationState({
      status: 'idle',
      simulatedTime: null,
      currentDay: 1,
      elapsedSeconds: 0,
      config: { period: 5, startDate: new Date() },
      simulationId: null,
    })
    setSimulationData({
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
      }
    })
    setNotifications([])
    setBellUnreadCount(0)
    simIdRef.current = null
    statusRef.current = 'idle'
  }, [])

  const cancelFlightDuringSimulation = useCallback(async (flightId) => {
    const simId = simIdRef.current
    if (!simId) throw new Error('No hay simulación activa')
    const result = await simulationApi.cancelFlight(simId, flightId)
    const msg = result?.appliedNextDay
      ? `Regla <1h aplicada: se canceló el vuelo siguiente (ID ${result.cancelledFlightId}) en la misma ruta. ALNS replanificando.`
      : `Vuelo ${result?.cancelledFlightId ?? flightId} cancelado. El ALNS está replanificando las rutas afectadas.`
    addNotification(msg, 'warning')
  }, [addNotification])

  const cancelSimulation = useCallback(async () => {
    firstBatchReadyRef.current = false
    setFirstBatchReady(false)
    setSelectedAirportCode(null)
    setSelectedFlightId(null)
    setSelectedShipmentId(null)
    const id = simIdRef.current
    disconnectSimulationWebSocket()
    if (shipmentPollRef.current) { clearInterval(shipmentPollRef.current); shipmentPollRef.current = null }
    if (flightPollRef.current) { clearInterval(flightPollRef.current); flightPollRef.current = null }
    if (id) {
      try { await simulationApi.stop(id) } catch (e) { console.error('[cancelSimulation] stop error:', e.message) }
    }
    simIdRef.current = null
    statusRef.current = 'idle'
    setSimulationState({
      status: 'idle',
      simulatedTime: null,
      currentDay: 1,
      elapsedSeconds: 0,
      config: { period: 5, startDate: new Date() },
      simulationId: null,
    })
    setSimulationData({
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
      }
    })
    setNotifications([])
    setBellUnreadCount(0)
  }, [])

  // ── attachToSimulation ───────────────────────────────────────────────────────
  // Recibe un SimulationDto ya existente (del backend) y engancha el contexto
  // local a él: carga airports/flights, setea estado y suscribe el WebSocket.
  // Es el mismo flujo que reconnect(), pero llamable externamente (cross-PC attach,
  // F5, regreso desde otra pestaña, etc.).
  const attachToSimulation = useCallback(async (active) => {
    try {
      simIdRef.current = active.id
      // El backend envía fechas naive en UTC (sin sufijo 'Z'); si no se fuerza
      // el parseo a UTC, new Date() las interpreta en la zona horaria local del
      // navegador, desalineando startDate/simulatedTime y rompiendo el cálculo
      // de "transcurrido" en fmtSimElapsed.
      const asUtc = (str) => str ? new Date(String(str).endsWith('Z') ? str : str + 'Z') : null
      const simTime = active.simulatedTime
        ? asUtc(active.simulatedTime)
        : asUtc(active.startDate)
      simTimeRef.current = simTime
      const frontendStatus = active.status === 'PLAYING' ? 'running'
        : active.status === 'BUFFERING' ? 'planning'
          : active.status === 'FINISHED' ? 'finished'
            : 'paused'
      statusRef.current = frontendStatus

      const [realAirports, realFlights] = await Promise.allSettled([
        airportApi.getAll(),
        flightApi.getAll(null, true),
      ])

      const nextAirports = realAirports.status === 'fulfilled'
        ? realAirports.value.map(a => ({
          ...a,
          iata: a.iata || a.iataCode,
          iataCode: a.iata || a.iataCode,
          lat: a.latitude,
          lon: a.longitude,
          occupancy: a.occupancyPct || 0,
          // TODO: fix continent in DB — temporary patch for airports returning 'unknown'
          continent: (!a.continent || a.continent.toLowerCase() === 'unknown') ? 'Sudamérica' : a.continent,
        }))
        : []

      const nextFlights = realFlights.status === 'fulfilled'
        ? realFlights.value.map(f => ({
          ...f,
          origin: f.originIata,
          destination: f.destinationIata,
          departureUTC: f.departureTime ? (String(f.departureTime).endsWith('Z') ? f.departureTime : f.departureTime + 'Z') : null,
          arrivalUTC: f.arrivalTime ? (String(f.arrivalTime).endsWith('Z') ? f.arrivalTime : f.arrivalTime + 'Z') : null,
          capacity: f.baggageCapacity,
          bagsAboard: f.currentLoad,
          airline: f.airlineName || f.airlineIata || '—',
          backendId: f.id,
        }))
        : []

      setSimulationData(prev => ({ ...prev, airports: nextAirports, flights: nextFlights }))

      if (frontendStatus !== 'planning') {
        firstBatchReadyRef.current = true
        setFirstBatchReady(true)
      }

      let currentDay = 1
      if (active.simulatedTime && active.startDate) {
        const start = asUtc(active.startDate)
        start.setUTCHours(0, 0, 0, 0)
        const current = asUtc(active.simulatedTime)
        const diffDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        currentDay = diffDays + 1
      }

      setSimulationState({
        status: frontendStatus,
        simulatedTime: simTime,
        currentDay,
        elapsedSeconds: 0,
        config: { period: active.periodDays, startDate: asUtc(active.startDate) },
        simulationId: active.id,
      })

      if (frontendStatus === 'finished') {
        try {
          const kpiList = await simulationApi.getKpis(active.id)
          if (kpiList && kpiList.length > 0) {
            const latest = kpiList[kpiList.length - 1]
            setSimulationData(prev => ({
              ...prev,
              kpis: {
                ...prev.kpis,
                onTimeDeliveryPct: latest.onTimePct ?? 100,
                avgFlightOccupancy: latest.avgFlightOccupancy ?? 0,
                avgWarehouseOccupancy: latest.avgWarehouseOccupancy ?? 0,
                totalDelayedBags: latest.delayedCount ?? 0,
              }
            }))
          }
        } catch (e) {
          console.error('Error fetching final KPIs:', e)
        }
      }

      await loadShipments()
      if (shipmentPollRef.current) clearInterval(shipmentPollRef.current)
      shipmentPollRef.current = setInterval(loadShipments, 5000)
      if (flightPollRef.current) clearInterval(flightPollRef.current)
      flightPollRef.current = setInterval(refreshInFlightFlights, 5000)

      if (active.status === 'PLAYING' || active.status === 'BUFFERING' || active.status === 'PAUSED') {
        connectSimulationWebSocket(active.id, handleTickEvent, handleAlert, handlePlanProgress)
      }

      simLogger.info(`Enganchado a simulación ID=${active.id}, estado=${active.status}`)
    } catch (e) {
      simLogger.warn('attachToSimulation error: ' + (e?.message ?? e))
    }
  }, [handleTickEvent, handleAlert, handlePlanProgress, loadShipments, refreshInFlightFlights])

  // On mount: reconnect to any active simulation (handles F5, new tabs, cross-PC).
  // Usa el mismo attachToSimulation para no duplicar lógica.
  useEffect(() => {
    async function reconnect() {
      try {
        const sims = await simulationApi.getAll()
        const actives = sims.filter(s => ['PLAYING', 'BUFFERING', 'PAUSED'].includes(s.status))
        if (!actives.length) return
        await attachToSimulation(actives[actives.length - 1])
      } catch (e) {
        // No active simulation found or backend unavailable — stay idle
      }
    }
    reconnect()
  }, [attachToSimulation]) // eslint-disable-line react-hooks/exhaustive-deps

  const matchesSemaphore = (pct, filter) => {
    if (filter === 'ALL') return true
    if (filter === 'EMPTY') return pct === 0
    if (filter === 'LOW') return pct > 0 && pct < 25
    if (filter === 'MEDIUM') return pct >= 25 && pct < 50
    if (filter === 'HIGH') return pct >= 50 && pct < 90
    if (filter === 'CRITICAL') return pct >= 90
    return true
  }

  // Compute next departure and arrival for each airport
  const airportsWithTimes = useMemo(() => {
    return (simulationData.airports || []).map(a => {
      const airportCode = a.iata || a.iataCode

      // Next departing flight
      const departingFlights = (simulationData.flights || []).filter(f => f.origin === airportCode && f.status !== 'LANDED' && f.status !== 'CANCELLED')
      const nextDepFlight = departingFlights.reduce((acc, f) => {
        if (!acc || new Date(f.departureUTC) < new Date(acc.departureUTC)) return f
        return acc
      }, null)

      // Next arriving flight
      const arrivingFlights = (simulationData.flights || []).filter(f => f.destination === airportCode && f.status !== 'LANDED' && f.status !== 'CANCELLED')
      const nextArrFlight = arrivingFlights.reduce((acc, f) => {
        if (!acc || new Date(f.arrivalUTC) < new Date(acc.arrivalUTC)) return f
        return acc
      }, null)

      return {
        ...a,
        id: airportCode, // Ensure it has a unique id field for DataGrid
        nextDeparture: nextDepFlight ? nextDepFlight.departureUTC : null,
        nextDepartureFlight: nextDepFlight ? nextDepFlight.id : null,
        nextArrival: nextArrFlight ? nextArrFlight.arrivalUTC : null,
        nextArrivalFlight: nextArrFlight ? nextArrFlight.id : null,
      }
    })
  }, [simulationData.airports, simulationData.flights])

  // Filtered warehouses
  const filteredAirports = useMemo(() => {
    return airportsWithTimes.filter(a => {
      const name = a.iata || a.iataCode || ''
      const city = a.city || ''
      const country = a.country || ''
      const matchesSearch = name.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
        city.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
        country.toLowerCase().includes(warehouseSearch.toLowerCase())
      const matchesRegion = warehouseRegion === 'ALL' || a.continent === warehouseRegion
      
      const capacity = a.warehouseCapacity || 500
      const current = a.currentOccupancy || 0
      const pct = a.occupancy || (current / capacity) * 100
      const matchesSem = matchesSemaphore(pct, warehouseSemaphore)

      return matchesSearch && matchesRegion && matchesSem
    })
  }, [airportsWithTimes, warehouseSearch, warehouseRegion, warehouseSemaphore])

  // Filtered flights
  const filteredFlights = useMemo(() => {
    return (simulationData.flights || []).filter(f => {
      const matchesSearch = String(f.id).toLowerCase().includes(flightSearch.toLowerCase()) ||
        `${f.origin}-${f.destination}`.toLowerCase().includes(flightSearch.toLowerCase())
      const matchesOrigin = flightOrigin === 'ALL' || f.origin === flightOrigin
      const matchesDest = flightDest === 'ALL' || f.destination === flightDest
      
      const capacity = f.capacity || 1
      const pct = ((f.bagsAboard || 0) / capacity) * 100
      const matchesSem = matchesSemaphore(pct, flightSemaphore)

      return matchesSearch && matchesOrigin && matchesDest && matchesSem
    })
  }, [simulationData.flights, flightSearch, flightOrigin, flightDest, flightSemaphore])

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
    planningProgress,
    blockHistory,
    totalSimBlocks,
    firstBatchReady,
    animClockRef,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    cancelSimulation,
    cancelFlightDuringSimulation,
    dismissNotification,
    bellUnreadCount,
    markBellRead,
    attachToSimulation,

    // Selection states
    selectedAirportCode,
    setSelectedAirportCode,
    selectedFlightId,
    setSelectedFlightId,
    selectedShipmentId,
    setSelectedShipmentId,
    selectedShipmentRoute,
    shipmentRouteLoading,
    fetchShipmentRoute,
    clearShipmentRoute,
    activePanelTab,
    setActivePanelTab,

    // Filters states & setters
    warehouseSearch,
    setWarehouseSearch,
    warehouseRegion,
    setWarehouseRegion,
    warehouseSemaphore,
    setWarehouseSemaphore,
    flightSearch,
    setFlightSearch,
    flightOrigin,
    setFlightOrigin,
    flightDest,
    setFlightDest,
    flightSemaphore,
    setFlightSemaphore,

    // Computed filtered lists
    airportsWithTimes,
    filteredAirports,
    filteredFlights,
  }
}