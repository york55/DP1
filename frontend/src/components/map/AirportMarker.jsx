import React from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import { getSemaphoreColor } from '../../utils/semaphoreUtils'
import AirportPopup from './AirportPopup'
import { useSimulationContext } from '../../context/SimulationContext'

/**
 * AirportMarker — renders a colored CircleMarker for an airport on the map.
 * Color is derived from the airport's current occupancy via semaphore levels.
 */
function AirportMarker({ airport, incomingCount = 0, outgoingCount = 0 }) {
  const { lat, lon, occupancy, iata } = airport
  const color = getSemaphoreColor(occupancy)

  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  const setSelectedAirportCode = context ? context.setSelectedAirportCode : null
  const setActivePanelTab = context ? context.setActivePanelTab : null

  return (
    <CircleMarker
      center={[lat, lon]}
      radius={6}
      pane="airportPane"
      pathOptions={{
        color: '#FFFFFF',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      }}
      eventHandlers={{
        click: () => {
          if (setSelectedAirportCode && setActivePanelTab) {
            setSelectedAirportCode(iata)
            setActivePanelTab(2) // 2 corresponds to Warehouses Tab
          }
        }
      }}
    >
      <Popup>
        <AirportPopup
          airport={airport}
          incomingCount={incomingCount}
          outgoingCount={outgoingCount}
        />
      </Popup>
    </CircleMarker>
  )
}

export default React.memo(AirportMarker)
