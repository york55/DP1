import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ScenarioSelectorPage from '../pages/ScenarioSelectorPage'
import SimulationConfigPage from '../pages/SimulationConfigPage'
import SimulationRunningPage from '../pages/SimulationRunningPage'
import SimulationSummaryPage from '../pages/SimulationSummaryPage'
import RealtimeOperationsPage from '../pages/Operacion/OperacionDiaria'
import AirportManagementPage from '../pages/AirportManagementPage'
import FlightManagementPage from '../pages/FlightManagementPage'
import EnvioCargaPage from '../pages/EnvioCargaPage'
import ClpSimulationConfigPage from '../pages/ClpSimulationConfigPage'
import ClpSimulationRunningPage from '../pages/ClpSimulationRunningPage'
import ClpSimulationSummaryPage from '../pages/ClpSimulationSummaryPage'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScenarioSelectorPage />} />
        <Route path="/simulation/config" element={<SimulationConfigPage />} />
        <Route path="/simulation/running" element={<SimulationRunningPage />} />
        <Route path="/simulation/summary" element={<SimulationSummaryPage />} />
        <Route path="/operacion" element={<RealtimeOperationsPage />} />
        <Route path="/almacenes" element={<AirportManagementPage />} />
        <Route path="/vuelos" element={<FlightManagementPage />} />
        <Route path="/envios" element={<EnvioCargaPage />} />
        {/* Collapse simulation */}
        <Route path="/clp/config" element={<ClpSimulationConfigPage />} />
        <Route path="/clp/running" element={<ClpSimulationRunningPage />} />
        <Route path="/clp/summary" element={<ClpSimulationSummaryPage />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}