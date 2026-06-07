import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'

export default function Tracks() {
  const [circuits, setCircuits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.circuits().then(d => {
      setCircuits(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Tracks</h1>
          <p className="subtitle">All circuits from the {new Date().getFullYear()} Formula 1 calendar</p>
        </div>
      </div>

      <div className="container">
        {circuits.length === 0 ? (
          <div className="empty-state"><p>No circuit data yet.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {circuits.map(c => (
              <Link
                key={c.circuit_id}
                to={`/tracks/${c.circuit_id}`}
                className="card"
                style={{ display: 'block', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--f1-red)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div className="card-body">
                  <div className="text-muted" style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed', marginBottom: 6 }}>
                    {c.country}
                  </div>
                  <div className="font-cond font-bold" style={{ fontSize: 20, marginBottom: 4 }}>{c.name}</div>
                  <div className="text-secondary" style={{ fontSize: 13 }}>{c.location}</div>
                  <div className="divider" style={{ margin: '12px 0' }} />
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {c.session_count} session{c.session_count !== 1 ? 's' : ''} recorded
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
