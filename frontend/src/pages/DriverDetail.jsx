import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
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

function sortByRound(rows) {
  return rows.slice().sort((a, b) =>
    (a.session?.round || 0) - (b.session?.round || 0) ||
    (SESSION_TYPE_ORDER[a.session?.session_type] || 9) - (SESSION_TYPE_ORDER[b.session?.session_type] || 9)
  )
}

// mode: 'race' (Grid/Status/Points), 'qualifying' (Status), 'practice' (Laps)
function ResultsTable({ rows, mode }) {
  const navigate = useNavigate()
  if (!rows.length) {
    return <div className="empty-state"><p>No {mode} results yet.</p></div>
  }
  return (
    <div className="table-wrap">
      <table className="f1-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Race</th>
            <th>Type</th>
            {mode === 'race' && <th className="text-right">Grid</th>}
            <th className="text-right">{mode === 'practice' ? 'Pos' : 'Finish'}</th>
            {mode === 'race' && <th>Status</th>}
            {mode === 'race' && <th className="text-right">Points</th>}
            {mode === 'practice' && <th className="text-right">Laps</th>}
            <th className="text-right">Best Lap</th>
          </tr>
        </thead>
        <tbody>
          {sortByRound(rows).map((r, i) => (
            <tr
              key={i}
              onClick={() => r.session?.session_key && navigate(`/sessions/${r.session.session_key}`)}
              style={{ cursor: 'pointer' }}
            >
              <td className="text-muted mono">{r.session?.round || '--'}</td>
              <td>
                {r.session?.gp_name || r.session?.race_name || r.session?.circuit?.name || r.session?.session_name || '--'}
              </td>
              <td className="text-secondary" style={{ fontSize: 12 }}>{r.session?.session_type}</td>
              {mode === 'race' && (
                <td className="text-right mono">
                  {r.status === 'DNS' ? 'DNS' : (r.grid_position || '--')}
                </td>
              )}
              <td className="text-right">
                {r.position
                  ? <PosBadge pos={r.position} />
                  : (['DNF', 'DNS', 'DSQ'].includes(r.status)
                      ? <span className="pos-badge pos-dnf">{r.status}</span>
                      : <span className="text-muted font-cond">--</span>)}
              </td>
              {mode === 'race' && (
                <td style={{ color: getStatusColor(r.status), fontSize: 12 }}>{r.status || '--'}</td>
              )}
              {mode === 'race' && <td className="text-right font-cond font-bold">{r.points != null ? r.points : '--'}</td>}
              {mode === 'practice' && <td className="text-right mono">{r.laps_completed || '--'}</td>}
              <td className="text-right mono" style={{ fontSize: 12 }}>
                {r.status === 'DNS' ? 'N/A' : (r.best_lap_time_str || '--')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DRIVER_TABS = [
  ['race', 'Race Results'],
  ['qualifying', 'Qualifying Results'],
  ['practice', 'Practice Results'],
  ['cars', 'Car Parts'],
]

export default function DriverDetail() {
  const { id } = useParams()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('race')

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

  // Results split by tab
  const raceTabRows = driver.results?.filter(r => ['Race', 'Sprint'].includes(r.session?.session_type)) || []
  const qualTabRows = driver.results?.filter(r => ['Qualifying', 'Sprint Qualifying'].includes(r.session?.session_type)) || []
  const practiceTabRows = driver.results?.filter(r => r.session?.session_type === 'Practice') || []

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
              <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 16 }}>
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
          <div className="section-label">{new Date().getFullYear()} Season Stats</div>
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
          {DRIVER_TABS.map(([t, label]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {/* Result tabs */}
        {tab === 'race' && <ResultsTable rows={raceTabRows} mode="race" />}
        {tab === 'qualifying' && <ResultsTable rows={qualTabRows} mode="qualifying" />}
        {tab === 'practice' && <ResultsTable rows={practiceTabRows} mode="practice" />}

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
