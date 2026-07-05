import { createContext, useContext, useState, useCallback } from 'react'
import client from '../api/client'

const STORAGE_KEY = 'ops_user'

const OpsAuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function OpsAuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError('')
    try {
      const res = await client.post('/ops/auth/login', { username, password })
      setUser(res.data)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res.data))
      return true
    } catch (err) {
      const msg = typeof err.response?.data === 'string'
        ? err.response.data
        : 'Usuario o contraseña incorrectos.'
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <OpsAuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </OpsAuthContext.Provider>
  )
}

export function useOpsAuth() {
  const ctx = useContext(OpsAuthContext)
  if (!ctx) throw new Error('useOpsAuth debe usarse dentro de OpsAuthProvider')
  return ctx
}
