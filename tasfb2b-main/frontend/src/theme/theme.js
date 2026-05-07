import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: { main: '#1F3864' },
    secondary: { main: '#2E75B6' },
    background: { default: '#FFFFFF', paper: '#F2F2F2' },
    text: { primary: '#212121', secondary: '#6B7280' },
    success: { main: '#2E7D32' },
    warning: { main: '#F9A825' },
    error: { main: '#C62828' },
    info: { main: '#0277BD' },
    border: '#BFBFBF',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiDataGrid: {
      defaultProps: {
        density: 'compact',
        pageSize: 25,
      },
    },
  },
})

export default theme
