// Renders a small country flag from flagcdn.com using the 2-letter ISO code
// returned by the API (e.g. "gb", "nl", "mc"). Falls back to a dash.
export default function Flag({ code, title, size = 24 }) {
  if (!code) return <span className="text-muted">--</span>
  const h = Math.round((size * 3) / 4) // flags are 4:3
  return (
    <img
      src={`https://flagcdn.com/${size}x${h}/${code}.png`}
      srcSet={`https://flagcdn.com/${size * 2}x${h * 2}/${code}.png 2x`}
      width={size}
      height={h}
      alt={title || code}
      title={title || ''}
      loading="lazy"
      style={{ borderRadius: 2, display: 'block', objectFit: 'cover' }}
    />
  )
}
