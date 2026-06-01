export default function PosBadge({ pos }) {
  if (!pos) return <span className="text-muted font-cond">--</span>
  const cls = pos === 1 ? 'pos-1' : pos === 2 ? 'pos-2' : pos === 3 ? 'pos-3' : 'pos-other'
  return <span className={`pos-badge ${cls}`}>{pos}</span>
}
