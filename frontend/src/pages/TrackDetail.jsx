import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import DriverChip from '../components/DriverChip.jsx'
import { formatDate, groupSessionsByRound } from '../utils.js'
import { SESSION_TYPE_ORDER } from '../constants.js'

export default function TrackDetail() {
  const { id } = useParams()
  const [circuit, setCircuit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.circuit(id).then(d => {
      setCircuit(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (!circuit) return <div className="container" style={{ padding: 32 }}><p className="text-muted">Circuit not found.</p></div>

  const rounds = groupSessionsByRound(circuit.sessions || [])

  return (
    <div>
      <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border)', padding: '28px 0 24px', marginBottom: 28 }}>
        <div className="container">
          <Link to="/tracks" className="back-link">&#8592; Tracks</Link>
          <div className="text-muted" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed', marginBottom: 6 }}>
            {circuit.country}
          </div>
          <h1 style={{ fontSize: 38 }}>{circuit.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{circuit.location}, {circuit.country}</p>
        </div>
      </div>

      <div className="container">
        {/* Track records */}
        {Object.keys(circuit.track_records || {}).length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="section-label">Track Records</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(circuit.track_records).map(([type, rec]) => (
                <div key={type} className="card" style={{ flex: '1 1 250px' }}>
                  <div className="card-header">
                    <h3>{type}</h3>
                  </div>
                  <div className="card-body">
                    <div className="font-cond font-bold" style={{ fontSize: 28, color: 'var(--f1-red)', marginBottom: 6 }}>
                      {rec.time_str}
                    </div>
                    {rec.driver && <DriverChip driver={rec.driver} showTeam />}
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                      {rec.session_type} · {rec.year}
                      {rec.compound && <span style={{ marginLeft: 8 }}>· {rec.compound}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions at this circuit */}
        <div>
          <div className="section-label">Sessions</div>
          {rounds.length === 0 ? (
            <div className="empty-state"><p>No sessions recorded yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {rounds.map(round => (
                <div key={`${round.year}-${round.round}`} className="card">
                  <div className="card-header">
                    <div>
                      <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.1em', fontFamily: 'Barlow Condensed', textTransform: 'uppercase' }}>
                        Round {round.round} · {round.year}
                      </span>
                    </div>
                  </div>
                  <div>
                    {round.sessions
                      .sort((a, b) => (SESSION_TYPE_ORDER[a.session_type] || 9) - (SESSION_TYPE_ORDER[b.session_type] || 9))
                      .map(s => (
                        <Link
                          key={s.session_key}
                          to={`/sessions/${s.session_key}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 18px', borderBottom: '1px solid var(--border)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="font-cond" style={{ fontWeight: 600, fontSize: 14 }}>{s.session_type}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>{formatDate(s.date_start)}</span>
                            <span className={`badge badge-${s.status}`}>{s.status}</span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
