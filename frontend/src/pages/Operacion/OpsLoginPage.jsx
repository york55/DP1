import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import { useOpsAuth } from '../../context/OpsAuthContext'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#F8FAFF',
    '&:hover fieldset': { borderColor: '#3B6AC7' },
    '&.Mui-focused fieldset': { borderColor: '#1F3864', borderWidth: 2 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#1F3864' },
}

export default function OpsLoginPage() {
  const { login, loading, error } = useOpsAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!username || !password) return
    login(username.trim(), password)
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F2F2F2',
    }}>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: 380,
          p: 4,
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(31,56,100,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: '#1F3864', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <LockIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F3864' }}>
            Operaciones en Tiempo Real
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', textAlign: 'center' }}>
            Ingresa con tu código de usuario para continuar
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

        <TextField
          label="Código de usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
          fullWidth
          autoFocus
          sx={inputSx}
          InputProps={{ startAdornment: <PersonIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} /> }}
        />

        <TextField
          label="Contraseña"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          fullWidth
          sx={inputSx}
          InputProps={{ startAdornment: <LockIcon sx={{ color: '#6B7280', mr: 1, fontSize: 20 }} /> }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !username || !password}
          sx={{
            mt: 1,
            backgroundColor: '#1F3864',
            borderRadius: '10px',
            fontWeight: 700,
            py: 1.3,
            textTransform: 'none',
            boxShadow: '0 4px 14px rgba(31,56,100,0.25)',
            '&:hover': { backgroundColor: '#162b4d' },
          }}
          startIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : null}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </Paper>
    </Box>
  )
}
