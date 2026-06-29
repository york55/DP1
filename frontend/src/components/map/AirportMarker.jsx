import React from 'react'
import { Marker, useMap } from 'react-leaflet'
import { getSemaphoreColor } from '../../utils/semaphoreUtils'
import { WAREHOUSE_ICONS } from './warehouseIcons'
import { useSimulationContext } from '../../context/SimulationContext'

function AirportMarker({ airport, incomingCount = 0, outgoingCount = 0, iconsVersion: _, onSelect }) {
  const { lat, lon, occupancy, iata } = airport
  const semaphore = getSemaphoreColor(occupancy)
  const map = useMap()

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
      icon={WAREHOUSE_ICONS[semaphore]}
      pane="airportPane"
      eventHandlers={{
        click: () => {
          if (setSelectedAirportCode && setActivePanelTab) {
            setSelectedAirportCode(iata)
            setActivePanelTab(2)
          }
          if (onSelect) {
            const pt = map.latLngToContainerPoint([lat, lon])
            onSelect({ airport, semaphore, incomingCount, outgoingCount, x: pt.x, y: pt.y })
          }
        }
      }}
    />
  )
}

export default React.memo(AirportMarker)
