import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let stompClient = null

export function connectSimulationWebSocket(simulationId, onTick, onAlert) {
  if (stompClient && stompClient.connected) {
    stompClient.deactivate()
  }
  const wsUrl = import.meta.env.VITE_WS_URL || '/ws';

  stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    reconnectDelay: 3000,
    onConnect: () => {
      console.log('[WS] Conectado al WebSocket STOMP')

      stompClient.subscribe(`/topic/simulation/${simulationId}/tick`, (msg) => {
        try {
          const event = JSON.parse(msg.body)
          onTick(event)
        } catch (e) {
          console.error('[WS] Error parsing tick event', e)
        }
      })

      stompClient.subscribe('/topic/alerts', (msg) => {
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
