import React, { createContext, useContext } from 'react'
import { useClpSimulation } from '../hooks/useClpSimulation'

const ClpSimulationContext = createContext(null)

export function ClpSimulationProvider({ children }) {
  const simulation = useClpSimulation()
  return (
    <ClpSimulationContext.Provider value={simulation}>
      {children}
    </ClpSimulationContext.Provider>
  )
}

export function useClpSimulationContext() {
  const ctx = useContext(ClpSimulationContext)
  if (!ctx) {
    throw new Error('useClpSimulationContext must be used within a ClpSimulationProvider')
  }
  return ctx
}
