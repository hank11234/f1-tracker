import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import DriverChip from '../components/DriverChip.jsx'
import PosBadge from '../components/PosBadge.jsx'
import { formatDate } from '../utils.js'

function StandingsMini({ title, items, renderRow, linkBase }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <Link to={linkBase} className="text-red" style={{ fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}>
          VIEW ALL
        </Link>
      </div>
      <div className="table-wrap" style={{ border: 'none' }}>
        <table className="f1-table">
          <tbody>
            {items.slice(0, 10).map((item, i) => renderRow(item, i))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PointsBar({ points, maxPoints }) {
  const pct = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="gap-bar-wrap" style={{ width: 80 }}>
        <div className="gap-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-cond font-bold">{points}</span>
    </div>
  )
}

export default function Home() {
  const [driverStandings, setDriverStandings] = useState([])
  const [constructorStandings, setConstructorStandings] = useState([])
  const [sessions, setSessions] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)

  useEffect(() => {
    // Each call fails independently so a single error doesn't blank everything
    const safe = (p, fallback) => p.catch(() => fallback)
    Promise.all([
      safe(api.driverStandings(), []),
      safe(api.constructorStandings(), []),
      safe(api.sessions(), []),
      safe(api.status(), null),
    ]).then(([ds, cs, sess, st]) => {
      setDriverStandings(ds)
      setConstructorStandings(cs)
      setSessions(sess)
      setStatus(st)
      setBackendError(!st)   // status endpoint is the backend health check
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading text="Loading season data" />

  if (backendError) return (
    <div className="container" style={{ padding: '48px 24px' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--f1-red)',
        borderRadius: 'var(--radius-lg)', padding: 32, maxWidth: 520,
      }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Backend Unreachable</div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          The frontend cannot reach the backend at <code style={{ background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 3 }}>localhost:8000</code>.
        </p>
        <ul style={{ color: 'var(--text-secondary)', marginTop: 12, paddingLeft: 20, lineHeight: 2, fontSize: 13 }}>
          <li>Make sure <strong>start.bat</strong> opened both the Backend and Frontend windows</li>
          <li>Check the <strong>"F1 Tracker - Backend"</strong> window for errors</li>
          <li>The backend window title should show <code>uvicorn</code> running</li>
          <li>Try refreshing this page once the backend is running</li>
        </ul>
      </div>
    </div>
  )

  const maxDriverPts = driverStandings[0]?.points || 1
  const maxTeamPts = constructorStandings[0]?.points || 1
  const now = new Date()

  // Most recently completed races, newest first
  const recentSessions = [...sessions]
    .filter(s => s.status === 'completed' && s.session_type === 'Race')
    .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
    .slice(0, 5)

  // Next upcoming races, nearest date first (use actual date, not stored status)
  const upcomingSessions = [...sessions]
    .filter(s => s.session_type === 'Race' && new Date(s.date_start) > now)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    .slice(0, 3)

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>{new Date().getFullYear()} Season</h1>
          {status && (
            <p className="subtitle">
              {status.drivers} drivers · {status.sessions} sessions · {status.laps.toLocaleString()} laps recorded
              {status.last_sync && ` · Last sync ${new Date(status.last_sync).toLocaleTimeString()}`}
            </p>
          )}
        </div>
      </div>

      <div className="container">
        {/* Summary stats */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-label">Season at a glance</div>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="value">{driverStandings[0]?.driver?.abbreviation || '--'}</span>
              <span className="label">Championship Leader</span>
            </div>
            <div className="stat-item">
              <span className="value">{driverStandings[0]?.points || '--'}</span>
              <span className="label">Leader Points</span>
            </div>
            <div className="stat-item">
              <span className="value">{constructorStandings[0]?.team?.name?.split(' ').pop() || '--'}</span>
              <span className="label">Constructors Leader</span>
            </div>
            <div className="stat-item">
              <span className="value">{constructorStandings[0]?.points || '--'}</span>
              <span className="label">Constructor Points</span>
            </div>
            <div className="stat-item">
              <span className="value">{sessions.filter(s => s.session_type === 'Race' && s.status === 'completed').length}</span>
              <span className="label">Races Complete</span>
            </div>
            <div className="stat-item">
              <span className="value">{driverStandings[0]?.wins || '--'}</span>
              <span className="label">Leader Wins</span>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          {/* Driver standings */}
          <StandingsMini
            title="Driver Championship"
            items={driverStandings}
            linkBase="/drivers"
            renderRow={(item) => (
              <tr key={item.driver?.driver_id}>
                <td style={{ width: 44 }}>
                  <PosBadge pos={item.position} />
                </td>
                <td>
                  <DriverChip driver={item.driver} showTeam />
                </td>
                <td className="text-right">
                  <PointsBar points={item.points} maxPoints={maxDriverPts} />
                </td>
                <td className="text-right text-muted" style={{ fontSize: 12 }}>
                  {item.wins}W
                </td>
              </tr>
            )}
          />

          {/* Constructor standings */}
          <StandingsMini
            title="Constructor Championship"
            items={constructorStandings}
            linkBase="/teams"
            renderRow={(item) => (
              <tr key={item.team?.constructor_id}>
                <td style={{ width: 44 }}>
                  <PosBadge pos={item.position} />
                </td>
                <td>
                  <span className="driver-chip">
                    <span className="driver-color-bar" style={{ background: item.team?.color || '#e8002d' }} />
                    <span>
                      <span className="driver-abbrev">{item.team?.name}</span>
                    </span>
                  </span>
                </td>
                <td className="text-right">
                  <PointsBar points={item.points} maxPoints={maxTeamPts} />
                </td>
                <td className="text-right text-muted" style={{ fontSize: 12 }}>
                  {item.wins}W
                </td>
              </tr>
            )}
          />
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="section-label">Recent Sessions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentSessions.map(s => (
                <Link
                  key={s.session_key}
                  to={`/sessions/${s.session_key}`}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                >
                  <div>
                    <span className="font-cond font-bold" style={{ fontSize: 15 }}>
                      {s.circuit?.name || s.session_name}
                    </span>
                    <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.session_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="text-secondary" style={{ fontSize: 12 }}>
                      {formatDate(s.date_start)}
                    </span>
                    <span className="badge badge-completed">Completed</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingSessions.length > 0 && (
          <div>
            <div className="section-label">Upcoming</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingSessions.map(s => (
                <div
                  key={s.session_key}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span className="font-cond font-bold" style={{ fontSize: 15 }}>
                      {s.circuit?.name || s.session_name}
                    </span>
                    <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.session_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="text-secondary" style={{ fontSize: 12 }}>
                      {formatDate(s.date_start)}
                    </span>
                    <span className="badge badge-upcoming">Upcoming</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {driverStandings.length === 0 && constructorStandings.length === 0 && (
          <div className="empty-state">
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: 16, letterSpacing: '0.05em' }}>
              Standings not available yet
            </p>
            <p style={{ marginTop: 8, fontSize: 12, maxWidth: 480, margin: '8px auto 0' }}>
              Race result data is still being pulled from the APIs. Click <strong>Sync Now</strong> in the
              navbar to trigger a refresh, or wait — the backend auto-syncs every 15 minutes.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
