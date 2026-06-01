import { COMPOUND_SHORT } from '../constants.js'

export default function Tyre({ compound, age }) {
  const c = (compound || 'UNKNOWN').toUpperCase()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={`tyre tyre-${c}`}>{COMPOUND_SHORT[c] || '?'}</span>
      {age != null && <span className="text-muted" style={{ fontSize: 11 }}>+{age}</span>}
    </span>
  )
}
