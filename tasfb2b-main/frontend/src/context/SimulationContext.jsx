import React, { createContext, useContext } from 'react'
import { useSimulation } from '../hooks/useSimulation'

const SimulationContext = createContext(null)

export function SimulationProvider({ children }) {
  const simulation = useSimulation()

  return (
    <SimulationContext.Provider value={simulation}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulationContext() {
  const ctx = useContext(SimulationContext)
  if (!ctx) {
    throw new Error('useSimulationContext must be used within a SimulationProvider')
  }
  return ctx
}
