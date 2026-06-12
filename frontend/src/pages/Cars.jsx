import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import { PU_COMPONENTS } from '../constants.js'

export default function Cars() {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('driver')

  useEffect(() => {
    api.cars().then(d => {
      setCars(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const groups = groupBy === 'team'
    ? Object.values(
        cars.reduce((acc, c) => {
          const key = c.driver?.team?.constructor_id || 'unknown'
          if (!acc[key]) acc[key] = { team: c.driver?.team, drivers: [] }
          acc[key].drivers.push(c)
          return acc
        }, {})
      )
    : null

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Car Components</h1>
          <p className="subtitle">
            Power unit component usage — {new Date().getFullYear()} season. Exceeding the allocation triggers a grid penalty.
          </p>
        </div>
      </div>

      <div className="container">
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Colour key:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 2 }} />
            Normal
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: '#ff9800', borderRadius: 2 }} />
            At limit
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--f1-red)', borderRadius: 2 }} />
            Over limit (penalty)
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className={`tab-btn${groupBy === 'driver' ? ' active' : ''}`}
              onClick={() => setGroupBy('driver')}
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            >
              By Driver
            </button>
            <button
              className={`tab-btn${groupBy === 'team' ? ' active' : ''}`}
              onClick={() => setGroupBy('team')}
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginLeft: 4 }}
            >
              By Team
            </button>
          </div>
        </div>

        {/* Component key row */}
        <div className="table-wrap">
          <table className="f1-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Driver / Car</th>
                {PU_COMPONENTS.map(c => (
                  <th key={c.key} className="text-center" title={c.full} style={{ width: 70 }}>
                    {c.label}
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
                      /{c.limit}
                    </div>
                  </th>
                ))}
                <th>Penalty</th>
              </tr>
            </thead>
            <tbody>
              {cars.sort((a, b) => (a.driver?.number || 99) - (b.driver?.number || 99)).map(car => {
                const d = car.driver
                if (!d) return null
                const color = d.team?.color || '#e8002d'
                return (
                  <tr key={d.driver_id}>
                    <td>
                      <Link to={`/drivers/${d.driver_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 4, height: 24, background: color, borderRadius: 2, flexShrink: 0 }} />
                        <span>
                          <span className="font-cond font-bold">{d.abbreviation}</span>
                          <div className="text-secondary" style={{ fontSize: 11 }}>{d.team?.name}</div>
                        </span>
                      </Link>
                    </td>
                    {PU_COMPONENTS.map(comp => {
                      // Only changes are stored, so a missing component means the
                      // driver is still on their original (first) unit.
                      const count = car.components?.[comp.key] || 1
                      const isOver = count > comp.limit
                      const isAt = count === comp.limit
                      const changed = count > 1
                      return (
                        <td key={comp.key} className="text-center">
                          <span style={{
                            fontFamily: 'Barlow Condensed',
                            fontWeight: 800,
                            fontSize: 18,
                            color: isOver ? 'var(--f1-red)' : isAt ? '#ff9800' : changed ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}>
                            {count}
                          </span>
                        </td>
                      )
                    })}
                    <td>
                      {car.has_penalty ? (
                        <span className="badge badge-live">Penalty</span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>--</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="section-label" style={{ marginBottom: 8 }}>About Component Data</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
            Power unit component usage is tracked from FIA technical documents published before each race weekend.
            Use the <code style={{ background: 'var(--bg-primary)', padding: '1px 4px', borderRadius: 2 }}>POST /api/cars/update</code> endpoint
            to manually record component changes as they are published, or let the scheduled
            scraper fill them in. 2026 limits per season: ICE / Turbo / Exhaust = 4, MGU-K /
            Energy Store / Control Electronics = 3 (the MGU-H was removed for 2026).
          </p>
        </div>
      </div>
    </div>
  )
}
