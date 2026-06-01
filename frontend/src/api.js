const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  status: () => get('/status'),
  sync: () => post('/sync', {}),

  driverStandings: () => get('/standings/drivers'),
  constructorStandings: () => get('/standings/constructors'),

  drivers: () => get('/drivers'),
  driver: (id) => get(`/drivers/${id}`),

  teams: () => get('/teams'),
  team: (id) => get(`/teams/${id}`),

  circuits: () => get('/circuits'),
  circuit: (id) => get(`/circuits/${id}`),

  sessions: () => get('/sessions'),
  session: (key) => get(`/sessions/${key}`),
  driverLaps: (sessionKey, driverId) => get(`/sessions/${sessionKey}/laps/${driverId}`),

  cars: () => get('/cars'),
}
