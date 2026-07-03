import client from './client'

/**
 * API client for the Collapse simulation (/api/clp/simulations).
 * Same verbs as simulationApi but pointing to the Clp controller.
 */
export const clpSimulationApi = {
  create:  (req) => client.post('/clp/simulations', req).then(r => r.data),
  getAll:  ()    => client.get('/clp/simulations').then(r => r.data),
  getById: (id)  => client.get(`/clp/simulations/${id}`).then(r => r.data),
  start:   (id)  => client.put(`/clp/simulations/${id}/start`).then(r => r.data),
  pause:   (id)  => client.put(`/clp/simulations/${id}/pause`).then(r => r.data),
  resume:  (id)  => client.put(`/clp/simulations/${id}/resume`).then(r => r.data),
  stop:    (id)  => client.put(`/clp/simulations/${id}/stop`).then(r => r.data),
  getKpis: (id)  => client.get(`/clp/simulations/${id}/kpis`).then(r => r.data),
  resetDb: ()    => client.delete('/clp/simulations/reset').then(r => r.data),
  getActive: ()  => client.get('/clp/simulations/active'),
}
