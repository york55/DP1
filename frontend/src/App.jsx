import React from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { SimulationProvider } from './context/SimulationContext'
import AppRouter from './routes/AppRouter'
import DevFooter from './components/common/DevFooter'
import theme from './theme/theme'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SimulationProvider>
          <AppRouter />
          {/* <DevFooter /> */}
        </SimulationProvider>
      </LocalizationProvider>
    </ThemeProvider>
  )
}
