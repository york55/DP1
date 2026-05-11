import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import App from './App.jsx'

// Fix Leaflet default icon paths broken by Vite's asset bundling
L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconUrl,
})

// Global Error Logging
import { logger } from './utils/logger'
window.addEventListener('error', (event) => {
  logger.error('Global Error:', event.message, { filename: event.filename, lineno: event.lineno })
})
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
