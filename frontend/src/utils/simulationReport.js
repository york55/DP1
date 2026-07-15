import { formatUTCFull } from './timeUtils'

/**
 * Construye el mapa de asignaciones envío -> vuelo cruzando `shipments`
 * (que traen `currentFlight`) con la lista de `flights` cargada en el
 * contexto de simulación. Esto es lo que la última planificación estable
 * realmente asignó, no solo el conteo agregado del bloque ALNS.
 *
 * @param {Array} shipments
 * @param {Array} flights
 * @returns {Array} filas listas para tabla/reporte
 */
export function buildAssignmentRows(shipments = [], flights = []) {
  const flightById = new Map(
    flights.map(f => [String(f.id ?? f.backendId), f])
  )

  return shipments.map(s => {
    const flight = s.currentFlight != null ? flightById.get(String(s.currentFlight)) : null
    return {
      id: s.id,
      shipmentId: s.id,
      origin: s.origin || '—',
      destination: s.destination || '—',
      bags: s.totalBags ?? 0,
      status: s.status || '—',
      client: s.client || '—',
      deliveredAt: s.deliveredAt || null,
      flightId: flight ? (flight.id ?? flight.backendId) : null,
      flightAirline: flight ? (flight.airline || '—') : '—',
      flightOrigin: flight ? (flight.origin || '—') : '—',
      flightDestination: flight ? (flight.destination || '—') : '—',
      flightDeparture: flight ? flight.departureUTC : null,
      flightArrival: flight ? flight.arrivalUTC : null,
      flightStatus: flight ? flight.status : null,
    }
  })
}

const STATUS_LABELS = {
  IN_ORIGIN: 'En espera',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  DELAYED: 'Retrasado',
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatUTCFull(d)
}

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${Number(n).toFixed(2)}%`
}

/**
 * Genera el reporte detallado (Markdown, sin emojis, referencial) de la
 * corrida de simulación con la información real disponible en el frontend:
 * metadatos de sesión, cancelaciones, desglose por bloque/día de la
 * planificación y la tabla completa de asignaciones envío -> vuelo de la
 * última planificación estable.
 *
 * @param {Object} params
 * @param {Object} params.simulationState
 * @param {Object} params.kpis
 * @param {Array} params.shipments
 * @param {Array} params.flights
 * @param {Array} params.blockHistory
 * @returns {string} contenido Markdown
 */
export function buildSimulationMarkdownReport({
  simulationState,
  kpis,
  shipments = [],
  flights = [],
  blockHistory = [],
}) {
  const { simulationId, config, simulatedTime } = simulationState || {}

  const total = shipments.length
  const delivered = shipments.filter(s => s.status === 'DELIVERED').length
  const notAttended = shipments.filter(s => s.status !== 'DELIVERED').length
  const totalBags = shipments.reduce((acc, s) => acc + (s.totalBags || 0), 0)
  const deliveredBags = shipments.reduce((acc, s) => acc + (s.deliveredBags || 0), 0)
  const pendingBags = totalBags - deliveredBags

  const cancelledFlights = flights.filter(f => f.status === 'CANCELLED')

  const stableBlocks = blockHistory.filter(b => b.status === 'done')
  const lastStableBlock = stableBlocks.length > 0 ? stableBlocks[stableBlocks.length - 1] : null

  const assignmentRows = buildAssignmentRows(shipments, flights)

  const lines = []

  lines.push('# Reporte Detallado de Operaciones y Flujo de Equipaje')
  lines.push('')
  lines.push('> Documento operativo de trazabilidad generado por TASF-B2B a partir de la última planificación estable de la simulación.')
  lines.push('')

  // ── Metadatos de la corrida ─────────────────────────────────────────
  lines.push('## Metadatos de la Corrida')
  lines.push(`- **ID de Simulación**: \`${simulationId ?? '—'}\``)
  lines.push(`- **Fecha de Generación**: ${fmtDate(new Date())}`)
  lines.push(`- **Algoritmo de Optimización**: **${config?.algorithm || 'ALNS'}**`)
  lines.push(`- **Modo de Simulación**: Simulación de Periodo (${config?.period ?? '—'} días)`)
  lines.push(`- **Tiempo Simulado Final**: ${fmtDate(simulatedTime)}`)
  lines.push(`- **SLA Final Alcanzado (Entregas a Tiempo)**: \`${pct(kpis?.onTimeDeliveryPct)}\``)
  lines.push(`- **Ocupación Promedio de Vuelos**: \`${pct(kpis?.avgFlightOccupancy)}\``)
  lines.push(`- **Ocupación Promedio de Almacenes**: \`${pct(kpis?.avgWarehouseOccupancy)}\``)
  lines.push(`- **Total de Envíos**: ${total}`)
  lines.push(`- **Envíos Entregados**: ${delivered}`)
  lines.push(`- **Envíos No Atendidos (pendientes al cierre)**: ${notAttended}`)
  lines.push(`- **Maletas Totales**: ${totalBags}`)
  lines.push(`- **Maletas Entregadas**: ${deliveredBags}`)
  lines.push(`- **Maletas Pendientes**: ${pendingBags}`)
  lines.push('')

  // ── Cancelaciones ────────────────────────────────────────────────────
  lines.push('## Registro de Cancelaciones e Incidentes')
  if (cancelledFlights.length === 0) {
    lines.push('No se registraron cancelaciones de vuelos durante esta sesión de simulación.')
  } else {
    lines.push('| Vuelo ID | Origen | Destino | Aerolínea |')
    lines.push('| :---: | :---: | :---: | :---: |')
    cancelledFlights.forEach(f => {
      lines.push(`| ${f.id ?? f.backendId ?? '—'} | ${f.origin || '—'} | ${f.destination || '—'} | ${f.airline || '—'} |`)
    })
  }
  lines.push('')

  // ── Desglose de bloques de planificación ────────────────────────────
  lines.push('## Desglose de Bloques de Planificación (ALNS)')
  if (blockHistory.length === 0) {
    lines.push('No hay historial de bloques de planificación disponible para esta sesión.')
  } else {
    lines.push('| Bloque | Ventana Planificada | Lotes Asignados | Estado |')
    lines.push('| :---: | :---: | :---: | :---: |')
    blockHistory.forEach(b => {
      const ventana = `${fmtDate(b.windowStart)} → ${fmtDate(b.windowEnd)}`
      const lotes = `${b.assignedBatches ?? 0} / ${b.totalBatches ?? 0}`
      const estado = b.status === 'done' ? 'Estable' : (b.status === 'planning' ? 'Planificando' : (b.status || '—'))
      lines.push(`| ${(b.blockIndex ?? 0) + 1} de ${b.totalBlocks ?? '—'} | ${ventana} | ${lotes} | ${estado} |`)
    })
  }
  lines.push('')

  // ── Última planificación estable ────────────────────────────────────
  lines.push('## Última Planificación Estable')
  if (lastStableBlock) {
    lines.push(`Bloque **${(lastStableBlock.blockIndex ?? 0) + 1} de ${lastStableBlock.totalBlocks ?? '—'}**, ventana ${fmtDate(lastStableBlock.windowStart)} → ${fmtDate(lastStableBlock.windowEnd)}, con ${lastStableBlock.assignedBatches ?? 0}/${lastStableBlock.totalBatches ?? 0} lotes asignados.`)
  } else {
    lines.push('No se identificó un bloque marcado como estable; se muestra el estado final de asignaciones.')
  }
  lines.push('')
  lines.push('### Detalle de Asignaciones Envío → Vuelo')
  if (assignmentRows.length === 0) {
    lines.push('No hay envíos registrados para esta simulación.')
  } else {
    lines.push('| Envío ID | Origen | Destino | Maletas | Estado | Vuelo Asignado | Aerolínea | Salida (UTC) | Llegada (UTC) |')
    lines.push('| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |')
    assignmentRows.forEach(r => {
      const estado = STATUS_LABELS[r.status] || r.status
      const vuelo = r.flightId != null ? `${r.flightId} (${r.flightOrigin} → ${r.flightDestination})` : 'Sin asignar'
      lines.push(`| ${r.shipmentId} | ${r.origin} | ${r.destination} | ${r.bags} | ${estado} | ${vuelo} | ${r.flightAirline} | ${fmtDate(r.flightDeparture)} | ${fmtDate(r.flightArrival)} |`)
    })
  }
  lines.push('')
  lines.push('---')
  lines.push('> Reporte generado dinámicamente por TASF-B2B Control Tower.')

  return lines.join('\n')
}

/**
 * Dispara la descarga del reporte como archivo .md en el navegador.
 * @param {string} markdown
 * @param {string} filename
 */
export function downloadMarkdownReport(markdown, filename = 'reporte-simulacion.md') {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
