import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import { getSemaphoreColor } from '../../utils/semaphoreUtils'
import { WAREHOUSE_ICONS } from './warehouseIcons'
import AirportPopup from './AirportPopup'
import { useSimulationContext } from '../../context/SimulationContext'

/**
 * AirportMarker — renders a warehouse-shaped marker for an airport on the map.
 * Color is derived from the airport's current occupancy via semaphore levels.
 * Icon is looked up from WAREHOUSE_ICONS (pre-built, rasterized after init).
 */
function AirportMarker({ airport, incomingCount = 0, outgoingCount = 0, iconsVersion: _ }) {
  const { lat, lon, occupancy, iata } = airport

  let context = null
  try {
    context = useSimulationContext()
  } catch (e) {
    // context not available
  }
  const setSelectedAirportCode = context ? context.setSelectedAirportCode : null
  const setActivePanelTab = context ? context.setActivePanelTab : null

  return (
    <Marker
      position={[lat, lon]}
      icon={WAREHOUSE_ICONS[getSemaphoreColor(occupancy)]}
      pane="airportPane"
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
    </Marker>
  )
}

export default React.memo(AirportMarker)
