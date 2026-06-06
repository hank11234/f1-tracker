import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import DriverChip from '../components/DriverChip.jsx'
import PosBadge from '../components/PosBadge.jsx'
import Flag from '../components/Flag.jsx'
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

function SessionCard({ s, defaultBadge }) {
  const canceled = s.canceled
  const badge = canceled ? { label: 'Canceled', cls: 'badge-canceled' } : defaultBadge
  return (
    <Link
      to={`/sessions/${s.session_key}`}
      className={canceled ? 'session-canceled' : undefined}
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
      onMouseEnter={e => { if (!canceled) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
      onMouseLeave={e => { if (!canceled) e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="race-label" style={{ fontSize: 15 }}>
          <span className="font-cond font-bold">
            {s.race_name || s.circuit?.name || s.session_name}
          </span>
          {s.circuit?.location && (
            <span className={canceled ? 'font-cond' : undefined} style={{ color: 'var(--text-muted)', fontSize: canceled ? undefined : 12 }}>
              {'  '}{s.circuit.location}
            </span>
          )}
        </span>
        {s.circuit?.flag && <Flag code={s.circuit.flag} title={s.circuit.country} size={20} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="text-secondary" style={{ fontSize: 12 }}>{formatDate(s.date_start)}</span>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>
    </Link>
  )
}

export default function Home() {
  const [driverStandings, setDriverStandings] = useState([])
  const [constructorStandings, setConstructorStandings] = useState([])
  const [sessions, setSessions] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const navigate = useNavigate()

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

  // ── Derived "at a glance" figures ─────────────────────────────
  const totalRounds = new Set(
    sessions.filter(s => s.session_type === 'Race').map(s => s.round)
  ).size
  const racesComplete = sessions.filter(
    s => s.session_type === 'Race' && s.status === 'completed'
  ).length
  const nextRace = upcomingSessions[0]

  const driverGap =
    driverStandings.length >= 2
      ? Math.round(driverStandings[0].points - driverStandings[1].points)
      : null
  const teamGap =
    constructorStandings.length >= 2
      ? Math.round(constructorStandings[0].points - constructorStandings[1].points)
      : null

  const stats = [
    { value: driverStandings[0]?.driver?.abbreviation || '--', label: 'Championship Leader' },
    { value: driverStandings[0]?.points ?? '--', label: 'Leader Points' },
    { value: driverGap != null ? `+${driverGap}` : '--', label: 'Lead Over P2' },
    { value: driverStandings[0]?.wins ?? '--', label: 'Leader Wins' },
    { value: constructorStandings[0]?.team?.name?.split(' ')[0] || '--', label: 'Constructors Leader' },
    { value: constructorStandings[0]?.points ?? '--', label: 'Constructor Points' },
    { value: teamGap != null ? `+${teamGap}` : '--', label: 'Constructor Lead' },
    { value: totalRounds ? `${racesComplete} / ${totalRounds}` : racesComplete, label: 'Rounds Run' },
    { value: nextRace?.circuit?.location || nextRace?.circuit?.name || '--', label: 'Next Grand Prix' },
    { value: status ? status.laps.toLocaleString() : '--', label: 'Laps Recorded' },
  ]

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
            {stats.map((s, i) => (
              <div className="stat-item" key={i}>
                <span className="value">{s.value}</span>
                <span className="label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          {/* Driver standings */}
          <StandingsMini
            title="Driver Championship"
            items={driverStandings}
            linkBase="/drivers"
            renderRow={(item) => (
              <tr
                key={item.driver?.driver_id}
                onClick={() => item.driver && navigate(`/drivers/${item.driver.driver_id}`)}
                style={{ cursor: 'pointer' }}
              >
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
              <tr
                key={item.team?.constructor_id}
                onClick={() => item.team && navigate(`/teams/${item.team.constructor_id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ width: 44 }}>
                  <PosBadge pos={item.position} />
                </td>
                <td>
                  <span className="driver-chip">
                    <span className="driver-color-bar" style={{ background: item.team?.color || '#e8002d' }} />
                    <span>
                      <span className="driver-abbrev">{item.team?.name}</span>
                      <div className="driver-team-name">{item.team?.nationality || ''}</div>
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
                <SessionCard
                  key={s.session_key}
                  s={s}
                  defaultBadge={{ label: 'Completed', cls: 'badge-completed' }}
                />
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
                <SessionCard
                  key={s.session_key}
                  s={s}
                  defaultBadge={{ label: 'Upcoming', cls: 'badge-upcoming' }}
                />
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
