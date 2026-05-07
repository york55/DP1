import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ScenarioSelectorPage from '../pages/ScenarioSelectorPage'
import SimulationConfigPage from '../pages/SimulationConfigPage'
import SimulationRunningPage from '../pages/SimulationRunningPage'
import SimulationSummaryPage from '../pages/SimulationSummaryPage'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScenarioSelectorPage />} />
        <Route path="/simulation/config" element={<SimulationConfigPage />} />
        <Route path="/simulation/running" element={<SimulationRunningPage />} />
        <Route path="/simulation/summary" element={<SimulationSummaryPage />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
