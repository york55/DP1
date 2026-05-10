import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.message || err.message || 'Error de red'
    console.error('[API Error]', msg, err.response?.data)
    return Promise.reject(err)
  }
)

export default client
