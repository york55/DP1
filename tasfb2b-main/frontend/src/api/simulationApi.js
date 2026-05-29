import client from './client'

export const simulationApi = {
  create: (req) => client.post('/simulations', req).then(r => r.data),
  getAll: () => client.get('/simulations').then(r => r.data),
  getById: (id) => client.get(`/simulations/${id}`).then(r => r.data),
  start: (id) => client.put(`/simulations/${id}/start`).then(r => r.data),
  pause: (id) => client.put(`/simulations/${id}/pause`).then(r => r.data),
  resume: (id) => client.put(`/simulations/${id}/resume`).then(r => r.data),
  stop: (id) => client.put(`/simulations/${id}/stop`).then(r => r.data),
  getKpis: (id) => client.get(`/simulations/${id}/kpis`).then(r => r.data),
}

export const airportApi = {
  getAll: () => client.get('/airports').then(r => r.data),
}

export const flightApi = {
  getAll: (status, assignedOnly = false) => {
    const params = { ...(status ? { status } : {}), ...(assignedOnly ? { assignedOnly: true } : {}) }
    return client.get('/flights', { params }).then(r => r.data)
  },
  cancel: (id, reason) => client.post(`/flights/${id}/cancel`, { reason }).then(r => r.data),
}

export const shipmentApi = {
  getAll: (status) => {
    const params = status ? { status } : {}
    return client.get('/shipments', { params }).then(r => r.data)
  },
  getById: (id) => client.get(`/shipments/${id}/status`).then(r => r.data),
}

export const logApi = {
  send: (log) => client.post('/logs', log).then(r => r.data),
}
