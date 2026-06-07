import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import { getStatusColor } from '../utils.js'
import { PU_COMPONENTS, SESSION_TYPE_ORDER } from '../constants.js'

function sortTeamRows(rows) {
  return rows.slice().sort((a, b) =>
    (a.session?.round || 0) - (b.session?.round || 0) ||
    (SESSION_TYPE_ORDER[a.session?.session_type] || 9) - (SESSION_TYPE_ORDER[b.session?.session_type] || 9) ||
    (a.driver?.number || 0) - (b.driver?.number || 0)
  )
}

// mode: 'race' (Grid/Status/Points), 'qualifying' (no Status), 'practice' (Laps)
function TeamResultsTable({ rows, mode }) {
  const navigate = useNavigate()
  if (!rows.length) {
    return <div className="empty-state"><p>No {mode} results yet.</p></div>
  }
  return (
    <div className="table-wrap">
      <table className="f1-table">
        <thead>
          <tr>
            <th>Driver</th>
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
          {sortTeamRows(rows).map((r, i) => (
            <tr
              key={i}
              onClick={() => r.session?.session_key && navigate(`/sessions/${r.session.session_key}`)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                {r.driver && (
                  <Link
                    to={`/drivers/${r.driver.driver_id}`}
                    style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {r.driver.abbreviation}
                  </Link>
                )}
              </td>
              <td className="text-muted mono">{r.session?.round || '--'}</td>
              <td>{r.session?.gp_name || r.session?.race_name || r.session?.circuit?.name || r.session?.session_name || '--'}</td>
              <td className="text-secondary" style={{ fontSize: 12 }}>{r.session?.session_type}</td>
              {mode === 'race' && (
                <td className="text-right mono">{r.status === 'DNS' ? 'DNS' : (r.grid_position || '--')}</td>
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

const TEAM_TABS = [
  ['race', 'Race Results'],
  ['qualifying', 'Qualifying Results'],
  ['practice', 'Practice Results'],
  ['cars', 'Car Parts'],
]

export default function TeamDetail() {
  const { id } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('race')

  useEffect(() => {
    api.team(id).then(d => {
      setTeam(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (!team) return <div className="container" style={{ padding: 32 }}><p className="text-muted">Team not found.</p></div>

  const color = team.color || '#e8002d'
  const raceResults = team.results?.filter(r => r.session?.session_type === 'Race') || []
  const wins = raceResults.filter(r => r.position === 1).length
  const podiums = raceResults.filter(r => r.position && r.position <= 3).length
  const totalPoints = raceResults.reduce((sum, r) => sum + (r.points || 0), 0)

  // Results split by tab
  const raceTabRows = team.results?.filter(r => ['Race', 'Sprint'].includes(r.session?.session_type)) || []
  const qualTabRows = team.results?.filter(r => ['Qualifying', 'Sprint Qualifying'].includes(r.session?.session_type)) || []
  const practiceTabRows = team.results?.filter(r => r.session?.session_type === 'Practice') || []

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, #0d0d14 0%, ${color}22 100%)`,
        borderBottom: `3px solid ${color}`,
        padding: '28px 0 24px',
        marginBottom: 28,
      }}>
        <div className="container">
          <Link to="/teams" className="back-link">&#8592; Teams</Link>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <div style={{
              width: 8, height: 80, background: color, borderRadius: 4, flexShrink: 0,
            }} />
            <div>
              <div style={{ color, fontFamily: 'Barlow Condensed', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
                {team.nationality || 'F1 Constructor'}
              </div>
              <h1 style={{ fontSize: 40, lineHeight: 1 }}>{team.name}</h1>
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                {team.drivers.map(d => (
                  <Link key={d.driver_id} to={`/drivers/${d.driver_id}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '4px 10px',
                    fontSize: 13, fontFamily: 'Barlow Condensed', fontWeight: 600,
                  }}>
                    <span style={{ color, fontWeight: 800 }}>#{d.number}</span> {d.abbreviation}
                  </Link>
                ))}
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
            <div className="stat-item"><span className="value">{totalPoints}</span><span className="label">Total Points</span></div>
            <div className="stat-item"><span className="value">{wins}</span><span className="label">Wins</span></div>
            <div className="stat-item"><span className="value">{podiums}</span><span className="label">Podiums</span></div>
            <div className="stat-item"><span className="value">{raceResults.length}</span><span className="label">Race Entries</span></div>
            <div className="stat-item"><span className="value">{team.drivers.length}</span><span className="label">Drivers</span></div>
          </div>
        </div>

        <div className="tab-bar">
          {TEAM_TABS.map(([t, label]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'race' && <TeamResultsTable rows={raceTabRows} mode="race" />}
        {tab === 'qualifying' && <TeamResultsTable rows={qualTabRows} mode="qualifying" />}
        {tab === 'practice' && <TeamResultsTable rows={practiceTabRows} mode="practice" />}

        {tab === 'cars' && (
          <div>
            {team.drivers.map(driver => {
              const driverParts = team.car_parts?.filter(p => p.driver?.driver_id === driver.driver_id) || []
              const componentMap = {}
              for (const comp of PU_COMPONENTS) {
                const entries = driverParts.filter(p => p.component === comp.key)
                componentMap[comp.key] = entries.length > 0 ? Math.max(...entries.map(e => e.count)) : 0
              }
              return (
                <div key={driver.driver_id} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 4, height: 24, background: color, borderRadius: 2 }} />
                    <span className="font-cond font-bold" style={{ fontSize: 18 }}>
                      #{driver.number} {driver.abbreviation}
                    </span>
                  </div>
                  <div className="pu-grid">
                    {PU_COMPONENTS.map(comp => {
                      const count = componentMap[comp.key] || 0
                      const cls = count > comp.limit ? 'over-limit' : count === comp.limit ? 'at-limit' : ''
                      return (
                        <div key={comp.key} className={`pu-cell ${cls}`} title={comp.full}>
                          <span className="key">{comp.label}</span>
                          <span className="count">{count}</span>
                          <span className="key">/ {comp.limit}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {!team.car_parts?.length && (
              <p className="text-muted" style={{ fontSize: 13 }}>No component data recorded.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
