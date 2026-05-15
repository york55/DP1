import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use(req => {
  const skip = req.url?.includes('/logs')
  if (!skip) {
    console.debug(`[API] ${req.method?.toUpperCase()} ${req.baseURL || ''}${req.url}`)
  }
  return req
})

client.interceptors.response.use(
  res => {
    const skip = res.config.url?.includes('/logs')
    if (!skip) {
      console.debug(`[API] ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`)
    }
    return res
  },
  err => {
    const url = err.config?.url || ''
    const status = err.response?.status
    const msg = err.response?.data?.message || err.message || 'Error de red'
    console.error(`[API Error] ${status} ${err.config?.method?.toUpperCase()} ${url} — ${msg}`, err.response?.data)
    return Promise.reject(err)
  }
)

export default client
