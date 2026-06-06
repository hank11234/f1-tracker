import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import Tyre from '../components/Tyre.jsx'
import { formatLapTime, formatDate, getStatusColor } from '../utils.js'
import { PU_COMPONENTS, SESSION_TYPE_ORDER } from '../constants.js'

function StatBox({ value, label }) {
  return (
    <div className="stat-item">
      <span className="value">{value ?? '--'}</span>
      <span className="label">{label}</span>
    </div>
  )
}

export default function DriverDetail() {
  const { id } = useParams()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('results')

  useEffect(() => {
    api.driver(id).then(d => {
      setDriver(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (!driver) return <div className="container" style={{ padding: 32 }}><p className="text-muted">Driver not found.</p></div>

  const color = driver.team?.color || '#e8002d'
  const raceResults = driver.results?.filter(r => r.session?.session_type === 'Race') || []
  const qualResults = driver.results?.filter(r => r.session?.session_type === 'Qualifying') || []

  const wins = raceResults.filter(r => r.position === 1).length
  const podiums = raceResults.filter(r => r.position && r.position <= 3).length
  const points = raceResults.reduce((sum, r) => sum + (r.points || 0), 0)
  const currentStanding = driver.standings_history?.at(-1)

  const componentMap = {}
  for (const comp of PU_COMPONENTS) {
    const entries = driver.car_parts?.filter(p => p.component === comp.key) || []
    componentMap[comp.key] = entries.length > 0 ? Math.max(...entries.map(e => e.count)) : 0
  }

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, #0d0d14 0%, ${color}22 100%)`,
        borderBottom: `3px solid ${color}`,
        padding: '28px 0 24px',
        marginBottom: 28,
      }}>
        <div className="container">
          <Link to="/drivers" className="back-link">&#8592; Drivers</Link>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <div style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 800,
              fontSize: 96,
              color: `${color}33`,
              lineHeight: 1,
              userSelect: 'none',
              letterSpacing: '-4px',
            }}>
              {driver.number || '0'}
            </div>
            <div>
              <div style={{ color, fontFamily: 'Barlow Condensed', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
                {driver.team?.name || 'Unknown Team'}
              </div>
              <h1 style={{ fontSize: 48, lineHeight: 1 }}>
                {driver.first_name} <span style={{ color }}>{driver.last_name}</span>
              </h1>
              <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 16 }}>
                <span>{driver.nationality}</span>
                <span className="driver-abbrev" style={{ color, fontSize: 16 }}>{driver.abbreviation}</span>
                <span>#{driver.number}</span>
                {currentStanding && <span>P{currentStanding.position} Championship</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Stats */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">2025 Season Stats</div>
          <div className="stat-grid">
            <StatBox value={currentStanding?.position ? `P${currentStanding.position}` : '--'} label="Championship" />
            <StatBox value={currentStanding?.points ?? points} label="Points" />
            <StatBox value={wins} label="Wins" />
            <StatBox value={podiums} label="Podiums" />
            <StatBox value={raceResults.length} label="Races" />
            <StatBox value={qualResults.filter(r => r.position === 1).length} label="Pole Positions" />
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {['results', 'laps', 'cars'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'results' ? 'Race Results' : t === 'laps' ? 'Best Laps by Track' : 'Car Parts'}
            </button>
          ))}
        </div>

        {/* Results tab */}
        {tab === 'results' && (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Race</th>
                  <th>Type</th>
                  <th className="text-right">Grid</th>
                  <th className="text-right">Finish</th>
                  <th>Status</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Best Lap</th>
                </tr>
              </thead>
              <tbody>
                {driver.results?.slice().sort((a, b) =>
                    (a.session?.round || 0) - (b.session?.round || 0) ||
                    (SESSION_TYPE_ORDER[a.session?.session_type] || 9) - (SESSION_TYPE_ORDER[b.session?.session_type] || 9)
                  ).map((r, i) => (
                  <tr key={i}>
                    <td className="text-muted mono">{r.session?.round || '--'}</td>
                    <td>
                      <Link to={`/sessions/${r.session?.session_key}`} style={{ color: 'var(--text-primary)' }}>
                        {r.session?.race_name || r.session?.circuit?.name || r.session?.session_name || '--'}
                      </Link>
                    </td>
                    <td className="text-secondary" style={{ fontSize: 12 }}>{r.session?.session_type}</td>
                    <td className="text-right mono">
                      {r.grid_position
                        || (['Qualifying', 'Sprint Qualifying'].includes(r.session?.session_type) ? 'N/A' : '--')}
                    </td>
                    <td className="text-right">
                      <PosBadge pos={r.position} />
                    </td>
                    <td style={{ color: getStatusColor(r.status), fontSize: 12 }}>{r.status || '--'}</td>
                    <td className="text-right font-cond font-bold">{r.points != null ? r.points : '--'}</td>
                    <td className="text-right mono" style={{ fontSize: 12 }}>{r.best_lap_time_str || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Best laps tab */}
        {tab === 'laps' && (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Circuit</th>
                  <th>Session</th>
                  <th>Year</th>
                  <th className="text-right">Best Lap</th>
                  <th>Compound</th>
                  <th className="text-right">Lap #</th>
                </tr>
              </thead>
              <tbody>
                {driver.best_laps_by_circuit?.sort((a, b) => a.circuit.localeCompare(b.circuit)).map((lap, i) => (
                  <tr key={i}>
                    <td className="font-bold">{lap.circuit}</td>
                    <td className="text-secondary" style={{ fontSize: 12 }}>{lap.session_type}</td>
                    <td className="text-muted">{lap.year}</td>
                    <td className="text-right mono font-bold" style={{ color }}>{lap.time_str}</td>
                    <td><Tyre compound={lap.compound} /></td>
                    <td className="text-right text-muted">{lap.lap_number}</td>
                  </tr>
                ))}
                {!driver.best_laps_by_circuit?.length && (
                  <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 24 }}>No lap data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Car parts tab */}
        {tab === 'cars' && (
          <div>
            <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              Power unit component usage for 2025. Exceeding the allocation limit triggers a grid penalty.
            </div>
            <div className="pu-grid" style={{ marginBottom: 24 }}>
              {PU_COMPONENTS.map(comp => {
                const count = componentMap[comp.key] || 0
                const cls = count > comp.limit ? 'over-limit' : count === comp.limit ? 'at-limit' : ''
                return (
                  <div key={comp.key} className={`pu-cell ${cls}`} title={comp.full}>
                    <span className="key">{comp.label}</span>
                    <span className="count">{count || 0}</span>
                    <span className="key">/ {comp.limit}</span>
                  </div>
                )
              })}
            </div>
            {driver.car_parts?.length > 0 ? (
              <div className="table-wrap">
                <table className="f1-table">
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Component</th>
                      <th>Pool Count</th>
                      <th>Penalty</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driver.car_parts.sort((a, b) => b.round - a.round).map((p, i) => (
                      <tr key={i}>
                        <td className="text-muted mono">{p.round}</td>
                        <td className="font-bold">{p.component}</td>
                        <td>{p.count}</td>
                        <td style={{ color: p.penalty ? 'var(--f1-red)' : 'var(--green)' }}>
                          {p.penalty ? 'Yes' : 'No'}
                        </td>
                        <td className="text-secondary" style={{ fontSize: 12 }}>{p.notes || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: 13 }}>No component data recorded. Use the API endpoint to add part change records.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
