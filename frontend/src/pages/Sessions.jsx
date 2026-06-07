import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import { formatDate, groupSessionsByRound } from '../utils.js'
import { SESSION_TYPE_ORDER } from '../constants.js'

const SESSION_COLORS = {
  Race: 'var(--f1-red)',
  Qualifying: '#ff9800',
  'Sprint': '#6692FF',
  'Sprint Shootout': '#a78bfa',
  'Practice 1': '#27F4D2',
  'Practice 2': '#27F4D2',
  'Practice 3': '#27F4D2',
}

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.sessions().then(d => {
      setSessions(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter(s => s.session_type === filter)

  const rounds = groupSessionsByRound(filtered)

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Sessions</h1>
          <p className="subtitle">All sessions from the {new Date().getFullYear()} Formula 1 season</p>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['all', 'Race', 'Qualifying', 'Practice 1', 'Practice 2', 'Practice 3', 'Sprint'].map(f => (
            <button
              key={f}
              className={`tab-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 0 }}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {rounds.length === 0 ? (
          <div className="empty-state"><p>No sessions found.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {rounds.map(round => {
              const roundCanceled = round.sessions.some(s => s.canceled)
              return (
              <div key={`${round.year}-${round.round}`} className={roundCanceled ? 'card session-canceled' : 'card'}>
                <div className="card-header">
                  <div>
                    <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed' }}>
                      Round {round.round} · {round.year}
                    </span>
                    <h3 style={{
                      marginTop: 2,
                      textDecoration: roundCanceled ? 'line-through' : 'none',
                      textDecorationColor: roundCanceled ? 'var(--text-muted)' : undefined,
                      textDecorationThickness: roundCanceled ? '3px' : undefined,
                      opacity: roundCanceled ? 0.8 : 1,
                    }}>
                      {round.circuit?.name || 'Unknown Circuit'}
                      {roundCanceled && (
                        <span className="badge badge-canceled" style={{ marginLeft: 10, verticalAlign: 'middle', textDecoration: 'none' }}>
                          Canceled
                        </span>
                      )}
                    </h3>
                    <span className="text-secondary" style={{ fontSize: 12 }}>
                      {round.circuit?.location}, {round.circuit?.country}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '10px 0' }}>
                  {round.sessions
                    .sort((a, b) => (SESSION_TYPE_ORDER[a.session_type] || 9) - (SESSION_TYPE_ORDER[b.session_type] || 9))
                    .map(s => (
                      <Link
                        key={s.session_key}
                        to={`/sessions/${s.session_key}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 18px',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!s.canceled) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                        onMouseLeave={e => { if (!s.canceled) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{
                            width: 3, height: 20, background: SESSION_COLORS[s.session_type] || '#888',
                            borderRadius: 2, flexShrink: 0,
                          }} />
                          <span className="font-cond session-title" style={{ fontSize: 15, fontWeight: 600 }}>
                            {s.session_type}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            {formatDate(s.date_start)}
                          </span>
                          {s.canceled
                            ? <span className="badge badge-canceled">Canceled</span>
                            : <span className={`badge badge-${s.status}`}>{s.status}</span>}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
