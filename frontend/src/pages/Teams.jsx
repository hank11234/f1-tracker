import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Loading from '../components/Loading.jsx'
import PosBadge from '../components/PosBadge.jsx'
import Flag from '../components/Flag.jsx'

export default function Teams() {
  const [standings, setStandings] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.constructorStandings().catch(() => []),
      api.teams().catch(() => []),
    ]).then(([cs, teams]) => {
      setStandings(cs)
      setAllTeams(teams)
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading />

  const hasStandings = standings.length > 0

  const rows = hasStandings
    ? standings.map(s => ({ position: s.position, points: s.points, wins: s.wins, team: s.team }))
    : allTeams.map((t, i) => ({ position: i + 1, points: null, wins: null, team: t }))

  const maxPts = standings[0]?.points || 1

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Constructor Standings</h1>
          <p className="subtitle">
            {new Date().getFullYear()} Formula 1 World Constructors Championship
            {!hasStandings && ' — standings pending first race results sync'}
          </p>
        </div>
      </div>

      <div className="container">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>No team data yet. Click <strong>Sync Now</strong> in the navbar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="f1-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Nationality</th>
                  {hasStandings && <th className="text-center">Points</th>}
                  {hasStandings && <th className="text-center">Wins</th>}
                  {hasStandings && <th style={{ width: 140 }}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((item, idx) => {
                  const t = item.team
                  if (!t) return null
                  const pct = item.points ? Math.round((item.points / maxPts) * 100) : 0
                  return (
                    <tr key={t.constructor_id || idx}>
                      <td style={{ width: 50 }}>
                        <PosBadge pos={item.position} />
                      </td>
                      <td>
                        <Link to={`/teams/${t.constructor_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 4, height: 32, background: t.color, borderRadius: 2, flexShrink: 0 }} />
                          <span className="font-cond font-bold" style={{ fontSize: 16 }}>{t.name}</span>
                        </Link>
                      </td>
                      <td><Flag code={t.flag} title={t.nationality} /></td>
                      {hasStandings && (
                        <td className="text-center">
                          <span className="font-cond font-bold" style={{ fontSize: 20 }}>{item.points}</span>
                        </td>
                      )}
                      {hasStandings && <td className="text-center text-secondary">{item.wins}</td>}
                      {hasStandings && (
                        <td>
                          <div className="gap-bar-wrap" style={{ width: '100%' }}>
                            <div className="gap-bar-fill" style={{ width: `${pct}%`, background: t.color }} />
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
