export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
      padding: '48px 24px', textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 14, lineHeight: 1 }}>{icon}</div>
      <p style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 700,
        color: '#0B4F4A', margin: '0 0 8px',
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          fontSize: 13, color: '#9CA3AF', lineHeight: 1.6,
          margin: actionLabel ? '0 0 20px' : 0,
        }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 22px', borderRadius: 12, border: 'none',
            background: '#087F70',
            color: 'white', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(8,127,112,0.25)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
