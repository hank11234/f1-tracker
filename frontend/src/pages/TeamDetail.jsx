import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import { formatDate, getStatusColor } from '../utils.js'
import { PU_COMPONENTS } from '../constants.js'

export default function TeamDetail() {
  const { id } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('results')

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
          <div className="section-label">2025 Season Stats</div>
          <div className="stat-grid">
            <div className="stat-item"><span className="value">{totalPoints}</span><span className="label">Total Points</span></div>
            <div className="stat-item"><span className="value">{wins}</span><span className="label">Wins</span></div>
            <div className="stat-item"><span className="value">{podiums}</span><span className="label">Podiums</span></div>
            <div className="stat-item"><span className="value">{raceResults.length}</span><span className="label">Race Entries</span></div>
            <div className="stat-item"><span className="value">{team.drivers.length}</span><span className="label">Drivers</span></div>
          </div>
        </div>

        <div className="tab-bar">
          {['results', 'cars'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'results' ? 'Results' : 'Car Parts'}
            </button>
          ))}
        </div>

        {tab === 'results' && (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Race</th>
                  <th>Driver</th>
                  <th>Type</th>
                  <th className="text-right">Grid</th>
                  <th className="text-right">Finish</th>
                  <th>Status</th>
                  <th className="text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {team.results?.sort((a, b) => (b.session?.round || 0) - (a.session?.round || 0)).map((r, i) => (
                  <tr key={i}>
                    <td className="text-muted mono">{r.session?.round || '--'}</td>
                    <td>
                      <Link to={`/sessions/${r.session?.session_key}`} style={{ color: 'var(--text-primary)' }}>
                        {r.session?.circuit?.name || r.session?.session_name || '--'}
                      </Link>
                    </td>
                    <td>
                      {r.driver && (
                        <Link to={`/drivers/${r.driver.driver_id}`} style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}>
                          {r.driver.abbreviation}
                        </Link>
                      )}
                    </td>
                    <td className="text-secondary" style={{ fontSize: 12 }}>{r.session?.session_type}</td>
                    <td className="text-right mono">{r.grid_position || '--'}</td>
                    <td className="text-right"><PosBadge pos={r.position} /></td>
                    <td style={{ color: getStatusColor(r.status), fontSize: 12 }}>{r.status || '--'}</td>
                    <td className="text-right font-cond font-bold">{r.points || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
