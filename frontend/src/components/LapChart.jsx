import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatLapTime } from '../utils.js'

const COLORS = [
  '#e8002d', '#FF8000', '#3671C6', '#27F4D2', '#229971',
  '#FF87BC', '#B6BABD', '#6692FF', '#64C4FF', '#52E252',
]

function buildChartData(driversLaps) {
  // driversLaps: [{ driver, laps: [{lap_number, lap_time, ...}] }]
  if (!driversLaps.length) return []
  const maxLap = Math.max(...driversLaps.flatMap(d => d.laps.map(l => l.lap_number)))
  const data = []
  for (let i = 1; i <= maxLap; i++) {
    const row = { lap: i }
    for (const { driver, laps } of driversLaps) {
      const lap = laps.find(l => l.lap_number === i)
      if (lap && lap.lap_time && !lap.is_deleted && !lap.is_pit_out_lap) {
        row[driver.abbreviation] = lap.lap_time
      }
    }
    data.push(row)
  }
  return data
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-header)', border: '1px solid var(--border)',
      borderRadius: 4, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}>
        LAP {label}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13 }}>
          {p.dataKey}: {formatLapTime(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function LapChart({ driversLaps, height = 300 }) {
  if (!driversLaps?.length) return null
  const data = buildChartData(driversLaps)

  // Find reasonable Y axis range
  const allTimes = driversLaps
    .flatMap(d => d.laps)
    .filter(l => l.lap_time && !l.is_deleted && !l.is_pit_out_lap)
    .map(l => l.lap_time)

  if (!allTimes.length) return null
  const minT = Math.min(...allTimes)
  const maxT = Math.min(Math.max(...allTimes), minT + 15)

  return (
    <div className="lap-chart-wrap">
      <div className="section-label" style={{ marginBottom: 16 }}>Lap Times</div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="lap" tick={{ fontSize: 11 }} label={{ value: 'Lap', position: 'insideBottom', offset: -2, fontSize: 11 }} />
          <YAxis
            domain={[minT - 0.5, maxT + 0.5]}
            tickFormatter={formatLapTime}
            tick={{ fontSize: 11 }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }} />
          {driversLaps.map(({ driver }, i) => (
            <Line
              key={driver.abbreviation}
              type="monotone"
              dataKey={driver.abbreviation}
              stroke={driver.team?.color || COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
