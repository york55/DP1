import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let stompClient = null

export function connectSimulationWebSocket(simulationId, onTick, onAlert, onPlanProgress) {
  if (stompClient && stompClient.connected) {
    stompClient.deactivate()
  }
  const wsUrl = import.meta.env.VITE_WS_URL || '/ws';
  const connectStart = Date.now()

  stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    reconnectDelay: 3000,
    onConnect: () => {
      console.log(`[WS] Connected in ${Date.now() - connectStart}ms to sim ${simulationId}`)

      stompClient.subscribe(`/topic/simulation/${simulationId}/tick`, (msg) => {
        try {
          const event = JSON.parse(msg.body)
          onTick(event)
        } catch (e) {
          console.error('[WS] Error parsing tick event', e)
        }
      })

      stompClient.subscribe(`/topic/simulation/${simulationId}/plan-progress`, (msg) => {
        try {
          const snap = JSON.parse(msg.body)
          if (onPlanProgress) onPlanProgress(snap)
        } catch (e) {
          console.error('[WS] Error parsing plan-progress event', e)
        }
      })

      // Antes: '/topic/alerts' (global) — un cliente conectado a la simulación N
      // recibía también las alertas de cualquier otra simulación corriendo al
      // mismo tiempo (5 días o colapso). El backend ahora publica por
      // /topic/simulation/{id}/alerts, así que nos suscribimos solo a la nuestra.
      stompClient.subscribe(`/topic/simulation/${simulationId}/alerts`, (msg) => {
        try {
          const alert = JSON.parse(msg.body)
          if (onAlert) onAlert(alert)
        } catch (e) {
          console.error('[WS] Error parsing alert event', e)
        }
      })
    },
    onDisconnect: () => {
      console.log('[WS] Desconectado del WebSocket')
    },
    onStompError: (frame) => {
      console.error('[WS] STOMP error', frame)
    },
  })

  stompClient.activate()
  return stompClient
}

export function disconnectSimulationWebSocket() {
  if (stompClient) {
    stompClient.deactivate()
    stompClient = null
  }
}