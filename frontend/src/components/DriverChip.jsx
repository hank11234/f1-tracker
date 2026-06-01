export default function DriverChip({ driver, showNumber = true, showTeam = false }) {
  if (!driver) return <span className="text-muted">--</span>
  const color = driver.team?.color || '#e8002d'

  return (
    <span className="driver-chip">
      <span className="driver-color-bar" style={{ background: color }} />
      {showNumber && (
        <span className="driver-number">{driver.number || '--'}</span>
      )}
      <span>
        <span className="driver-abbrev">{driver.abbreviation}</span>
        {showTeam && (
          <div className="driver-team-name">{driver.team?.name || ''}</div>
        )}
      </span>
    </span>
  )
}
