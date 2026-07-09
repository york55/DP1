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
  resetDb: () => client.delete('/simulations/reset').then(r => r.data),
  cancelFlight: (simId, flightId) => client.post(`/simulations/${simId}/cancel-flight/${flightId}`).then(r => r.data),
}

export const airportApi = {
  getAll: () => client.get('/airports').then(r => r.data),
  getById: (id) => client.get(`/airports/${id}`).then(r => r.data),
  create: (data) => client.post('/airports', data).then(r => r.data),
  update: (id, data) => client.put(`/airports/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/airports/${id}`).then(r => r.data),
  getWarehouseDetail: (iata) => client.get(`/airports/iata/${iata}/warehouse-detail`).then(r => r.data),
}

export const flightApi = {
  getAll: (status, assignedOnly = false) => {
    const params = { ...(status ? { status } : {}), ...(assignedOnly ? { assignedOnly: true } : {}) }
    return client.get('/flights', { params }).then(r => r.data)
  },
  getById: (id) => client.get(`/flights/${id}`).then(r => r.data),
  create: (data) => client.post('/flights', data).then(r => r.data),
  update: (id, data) => client.put(`/flights/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/flights/${id}`).then(r => r.data),
  cancel: (id, reason) => client.post(`/flights/${id}/cancel`, { reason }).then(r => r.data),
  getBatches: (id) => client.get(`/flights/${id}/batches`).then(r => r.data),
  getCancelled: () => client.get('/flights', { params: { status: 'CANCELLED' } }).then(r => r.data),
}

export const shipmentApi = {
  getAll: (status) => {
    const params = status ? { status } : {}
    return client.get('/shipments', { params }).then(r => r.data)
  },
  getById: (id) => client.get(`/shipments/${id}/status`).then(r => r.data),
  getRoute: (id) => client.get(`/shipments/${id}/route`).then(r => r.data),
}

export const logApi = {
  send: (log) => client.post('/logs', log).then(r => r.data),
}
