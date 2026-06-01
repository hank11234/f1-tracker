import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import DriverChip from '../components/DriverChip.jsx'
import Tyre from '../components/Tyre.jsx'
import LapChart from '../components/LapChart.jsx'
import { formatLapTime, formatDate, getStatusColor } from '../utils.js'

export default function SessionDetail() {
  const { key } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('results')
  const [selectedDrivers, setSelectedDrivers] = useState([])

  useEffect(() => {
    api.session(key).then(d => {
      setSession(d)
      // Default: top 5 for chart
      if (d.results?.length) {
        setSelectedDrivers(d.results.slice(0, 5).map(r => r.driver?.driver_id).filter(Boolean))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [key])

  if (loading) return <Loading />
  if (!session) return <div className="container" style={{ padding: 32 }}><p className="text-muted">Session not found.</p></div>

  const isRace = session.session_type === 'Race'

  // Build lap chart data
  const chartDrivers = session.results
    ?.filter(r => selectedDrivers.includes(r.driver?.driver_id))
    .map(r => ({ driver: r.driver, laps: r.laps || [] })) || []

  // Leader's best lap for gap calculation
  const leaderBest = session.results?.[0]?.best_lap_time

  const toggleDriver = (driverId) => {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(d => d !== driverId)
        : [...prev, driverId]
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        padding: '28px 0 20px',
        marginBottom: 28,
      }}>
        <div className="container">
          <Link to="/sessions" className="back-link">&#8592; Sessions</Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed', marginBottom: 4 }}>
                Round {session.round} · {session.year}
              </div>
              <h1 style={{ fontSize: 34 }}>{session.session_type}</h1>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
                {session.circuit?.name} — {session.circuit?.location}, {session.circuit?.country}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                {formatDate(session.date_start)}
              </div>
            </div>
            <span className={`badge badge-${session.status}`} style={{ marginTop: 8 }}>{session.status}</span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="tab-bar">
          {['results', 'laps', 'pitstops', 'stints'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'pitstops' ? 'Pit Stops' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Results */}
        {tab === 'results' && (
          <div>
            <div className="table-wrap" style={{ marginBottom: 24 }}>
              <table className="f1-table">
                <thead>
                  <tr>
                    {isRace && <th style={{ width: 30 }}>Chart</th>}
                    <th style={{ width: 50 }}>Pos</th>
                    {isRace && <th style={{ width: 50 }}>Grid</th>}
                    <th>Driver</th>
                    <th>Team</th>
                    {isRace && <th>Status</th>}
                    {isRace && <th className="text-right">Laps</th>}
                    {isRace ? <th className="text-right">Gap</th> : <th className="text-right">Best Lap</th>}
                    {isRace && <th className="text-right">Points</th>}
                    {!isRace && <th className="text-right">Gap to P1</th>}
                    <th className="text-right">Fastest</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results?.map((r, i) => {
                    const dId = r.driver?.driver_id
                    const isSelected = selectedDrivers.includes(dId)
                    const gap = r.best_lap_time && leaderBest && r.best_lap_time !== leaderBest
                      ? `+${(r.best_lap_time - leaderBest).toFixed(3)}`
                      : i === 0 ? 'LEADER' : '--'
                    return (
                      <tr key={i}>
                        {isRace && (
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDriver(dId)}
                              style={{ accentColor: r.driver?.team?.color || 'var(--f1-red)', cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td><PosBadge pos={r.position} /></td>
                        {isRace && (
                          <td className="text-muted mono">{r.grid_position || '--'}</td>
                        )}
                        <td>
                          {r.driver ? (
                            <Link to={`/drivers/${r.driver.driver_id}`}>
                              <DriverChip driver={r.driver} />
                            </Link>
                          ) : '--'}
                        </td>
                        <td className="text-secondary" style={{ fontSize: 12 }}>
                          {r.driver?.team?.name || '--'}
                        </td>
                        {isRace && (
                          <td style={{ color: getStatusColor(r.status), fontSize: 12 }}>
                            {r.status || '--'}
                          </td>
                        )}
                        {isRace && <td className="text-right mono">{r.laps_completed || '--'}</td>}
                        <td className="text-right mono" style={{ fontSize: 12 }}>
                          {isRace ? (r.gap_to_leader || '--') : formatLapTime(r.best_lap_time)}
                        </td>
                        {isRace && (
                          <td className="text-right font-cond font-bold">{r.points || '--'}</td>
                        )}
                        {!isRace && (
                          <td className="text-right text-muted mono" style={{ fontSize: 12 }}>
                            {gap}
                          </td>
                        )}
                        <td className="text-right mono" style={{ fontSize: 12 }}>
                          {formatLapTime(r.best_lap_time)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Lap chart for race */}
            {isRace && chartDrivers.length > 0 && session.results?.some(r => r.laps?.length > 0) && (
              <LapChart driversLaps={chartDrivers} height={320} />
            )}
          </div>
        )}

        {/* Laps */}
        {tab === 'laps' && (
          <div>
            <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              Individual lap times for all drivers. Click a driver to filter.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {session.results?.map(r => {
                if (!r.driver) return null
                const isActive = selectedDrivers.includes(r.driver.driver_id)
                const color = r.driver.team?.color || '#e8002d'
                return (
                  <button
                    key={r.driver.driver_id}
                    onClick={() => toggleDriver(r.driver.driver_id)}
                    style={{
                      background: isActive ? color : 'var(--bg-card)',
                      color: isActive ? '#000' : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? color : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      padding: '4px 10px',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {r.driver.abbreviation}
                  </button>
                )
              })}
            </div>

            {chartDrivers.length > 0 && (
              <>
                <LapChart driversLaps={chartDrivers} height={300} />
                <div className="table-wrap" style={{ marginTop: 20 }}>
                  <table className="f1-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th className="text-right">Lap</th>
                        <th className="text-right">Time</th>
                        <th className="text-right">S1</th>
                        <th className="text-right">S2</th>
                        <th className="text-right">S3</th>
                        <th>Tyre</th>
                        <th className="text-right">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartDrivers.flatMap(({ driver, laps }) =>
                        laps.filter(l => !l.is_deleted).map((l, i) => (
                          <tr key={`${driver.driver_id}-${i}`} style={l.is_personal_best ? { background: 'rgba(57,181,74,0.08)' } : {}}>
                            <td>
                              <span className="font-cond font-bold" style={{ color: driver.team?.color }}>
                                {driver.abbreviation}
                              </span>
                            </td>
                            <td className="text-right mono">{l.lap_number}</td>
                            <td className="text-right mono font-bold" style={{ fontSize: 13 }}>
                              {formatLapTime(l.lap_time)}
                              {l.is_personal_best && <span style={{ color: 'var(--green)', marginLeft: 4, fontSize: 10 }}>PB</span>}
                              {l.is_pit_out_lap && <span style={{ color: '#ff9800', marginLeft: 4, fontSize: 10 }}>OUT</span>}
                            </td>
                            <td className="text-right mono text-muted">{l.sector1?.toFixed(3) || '--'}</td>
                            <td className="text-right mono text-muted">{l.sector2?.toFixed(3) || '--'}</td>
                            <td className="text-right mono text-muted">{l.sector3?.toFixed(3) || '--'}</td>
                            <td><Tyre compound={l.compound} /></td>
                            <td className="text-right mono text-muted">{l.tyre_age ?? '--'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {chartDrivers.length === 0 && (
              <div className="empty-state"><p>Select drivers above to view lap times.</p></div>
            )}
          </div>
        )}

        {/* Pit stops */}
        {tab === 'pitstops' && (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th className="text-right">Lap</th>
                  <th className="text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {session.pit_stops?.sort((a, b) => a.lap - b.lap).map((p, i) => (
                  <tr key={i}>
                    <td>
                      {p.driver ? (
                        <Link to={`/drivers/${p.driver.driver_id}`}>
                          <DriverChip driver={p.driver} />
                        </Link>
                      ) : '--'}
                    </td>
                    <td className="text-right mono">{p.lap}</td>
                    <td className="text-right mono font-bold" style={{ color: p.pit_duration < 25 ? 'var(--green)' : undefined }}>
                      {p.duration_str || '--'}
                    </td>
                  </tr>
                ))}
                {!session.pit_stops?.length && (
                  <tr><td colSpan={3} className="text-center text-muted" style={{ padding: 24 }}>No pit stop data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Stints */}
        {tab === 'stints' && (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th className="text-right">Stint</th>
                  <th>Compound</th>
                  <th className="text-right">Start Lap</th>
                  <th className="text-right">End Lap</th>
                  <th className="text-right">Laps</th>
                  <th className="text-right">Tyre Age</th>
                </tr>
              </thead>
              <tbody>
                {session.stints?.sort((a, b) => a.lap_start - b.lap_start).map((s, i) => (
                  <tr key={i}>
                    <td>
                      {s.driver ? (
                        <Link to={`/drivers/${s.driver.driver_id}`}>
                          <DriverChip driver={s.driver} />
                        </Link>
                      ) : '--'}
                    </td>
                    <td className="text-right mono">{s.stint}</td>
                    <td><Tyre compound={s.compound} /></td>
                    <td className="text-right mono">{s.lap_start}</td>
                    <td className="text-right mono">{s.lap_end || '--'}</td>
                    <td className="text-right mono font-bold">{s.laps || '--'}</td>
                    <td className="text-right mono text-muted">+{s.tyre_age}</td>
                  </tr>
                ))}
                {!session.stints?.length && (
                  <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 24 }}>No stint data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
