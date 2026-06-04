import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import Flag from '../components/Flag.jsx'

export default function Drivers() {
  const [standings, setStandings] = useState([])
  const [allDrivers, setAllDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.driverStandings().catch(() => []),
      api.drivers().catch(() => []),
    ]).then(([ds, drivers]) => {
      setStandings(ds)
      setAllDrivers(drivers)
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading />

  const hasStandings = standings.length > 0

  // If we have standings, show them. Otherwise fall back to raw driver list.
  const rows = hasStandings
    ? standings.map(s => ({
        position: s.position,
        points: s.points,
        wins: s.wins,
        driver: s.driver,
      }))
    : allDrivers.map(d => ({ position: null, points: null, wins: null, driver: d }))

  const maxPts = standings[0]?.points || 1

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Driver Standings</h1>
          <p className="subtitle">
            {new Date().getFullYear()} Formula 1 World Drivers Championship
            {!hasStandings && ' — standings pending first race results sync'}
          </p>
        </div>
      </div>

      <div className="container">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>No driver data yet. Click <strong>Sync Now</strong> in the navbar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Nat</th>
                  {hasStandings && <th className="text-center">Points</th>}
                  {hasStandings && <th className="text-center">Wins</th>}
                  {hasStandings && <th style={{ width: 120 }}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((item, idx) => {
                  const d = item.driver
                  if (!d) return null
                  const pct = item.points ? Math.round((item.points / maxPts) * 100) : 0
                  return (
                    <tr key={d.driver_id || idx}>
                      <td style={{ width: 50 }}>
                        {item.position
                          ? <PosBadge pos={item.position} />
                          : <span className="text-muted font-cond" style={{ fontSize: 13 }}>{idx + 1}</span>}
                      </td>
                      <td>
                        <Link to={`/drivers/${d.driver_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="driver-color-bar" style={{ background: d.team?.color || '#e8002d' }} />
                          <span>
                            <span className="driver-abbrev">{d.abbreviation}</span>
                            <span className="text-secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                              {d.first_name} {d.last_name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link to={`/teams/${d.team?.constructor_id}`} className="text-secondary" style={{ fontSize: 13 }}>
                          {d.team?.name || '--'}
                        </Link>
                      </td>
                      <td><Flag code={d.flag} title={d.nationality} /></td>
                      {hasStandings && (
                        <td className="text-center">
                          <span className="font-cond font-bold" style={{ fontSize: 18 }}>{item.points}</span>
                        </td>
                      )}
                      {hasStandings && (
                        <td className="text-center text-secondary">{item.wins}</td>
                      )}
                      {hasStandings && (
                        <td>
                          <div className="gap-bar-wrap" style={{ width: '100%' }}>
                            <div className="gap-bar-fill" style={{ width: `${pct}%`, background: d.team?.color || 'var(--f1-red)' }} />
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
