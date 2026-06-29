import React from 'react'

const SEMAPHORE_COLORS = { green: '#66BB6A', yellow: '#FB8C00', orange: '#E65100', red: '#C62828' }

export default function AirportMapPopup({ airport, incomingCount = 0, outgoingCount = 0, semaphore }) {
  const { iata, city, country, occupancy = 0, warehouseCapacity, currentOccupancy } = airport
  const barColor = SEMAPHORE_COLORS[semaphore] || '#66BB6A'
  const maxCapacity = warehouseCapacity ?? 0
  const currentBags = currentOccupancy ?? Math.round((occupancy / 100) * maxCapacity)

  return (
    <div style={{ fontFamily: 'Roboto, sans-serif', minWidth: 160 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1F3864' }}>{iata}</div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{city}, {country}</div>
      <div style={{ fontSize: 10, color: '#6B7280', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>Capacidad</span>
        <span style={{ fontWeight: 600 }}>{currentBags} / {maxCapacity || '—'} maletas ({occupancy.toFixed(1)}%)</span>
      </div>
      <div style={{ background: '#E0E0E0', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{ background: barColor, width: `${Math.min(occupancy, 100)}%`, height: '100%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6, borderTop: '1px solid #eee', paddingTop: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3864' }}>{incomingCount}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>Entrada</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3864' }}>{outgoingCount}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>Salida</div>
        </div>
      </div>
    </div>
  )
}
