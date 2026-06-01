export function formatLapTime(seconds) {
  if (seconds == null) return '--'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : `${s}`
}

export function formatGap(seconds) {
  if (seconds == null) return '--'
  if (seconds === 0) return 'LEADER'
  return `+${seconds.toFixed(3)}`
}

export function formatDuration(seconds) {
  if (seconds == null) return '--'
  return `${seconds.toFixed(3)}s`
}

export function formatDate(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatDateTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function positionSuffix(n) {
  if (!n) return '--'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function deltaLapTime(lap, base) {
  if (lap == null || base == null) return null
  return lap - base
}

export function formatDelta(seconds) {
  if (seconds == null) return '--'
  const sign = seconds >= 0 ? '+' : '-'
  return `${sign}${Math.abs(seconds).toFixed(3)}`
}

export function getStatusColor(status) {
  if (!status) return 'var(--text-muted)'
  if (status === 'Finished') return 'var(--green)'
  if (status.startsWith('+')) return 'var(--text-secondary)'
  return '#ff6b6b'
}

export function groupSessionsByRound(sessions) {
  const rounds = {}
  for (const s of sessions) {
    const key = `${s.year}-${s.round}`
    if (!rounds[key]) {
      rounds[key] = {
        year: s.year,
        round: s.round,
        circuit: s.circuit,
        sessions: [],
      }
    }
    rounds[key].sessions.push(s)
  }
  return Object.values(rounds).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.round - a.round
  )
}
