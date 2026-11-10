// example: [{ icon, title, sub }] — filas grises de muestra para que se entienda
// cómo se verá la pantalla cuando tenga datos (UX nov 2026).
export default function EmptyState({ icon, title, description, actionLabel, onAction, example }) {
  return (
    <div style={{
      background: 'white', borderRadius: 20, border: '1px solid #E6E3DB',
      padding: example ? '24px 18px 28px' : '48px 24px', textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      {example?.length > 0 && (
        <div aria-hidden="true" style={{ marginBottom: 20, textAlign: 'left' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5E7480' }}>Así se verá</p>
          {example.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#F4F2EC', marginBottom: 8, opacity: 0.75 }}>
              <span style={{ fontSize: 22 }}>{e.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#30454F' }}>{e.title}</span>
                {e.sub && <span style={{ display: 'block', fontSize: 13, color: '#5E7480' }}>{e.sub}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {!example?.length && <div style={{ fontSize: 48, marginBottom: 14, lineHeight: 1 }}>{icon}</div>}
      <p style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 18, fontWeight: 800,
        color: '#14303D', margin: '0 0 8px',
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          fontSize: 15, color: '#4E6470', lineHeight: 1.55,
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
            padding: '14px 26px', borderRadius: 14, border: 'none',
            background: '#0C6C9C',
            color: 'white', fontWeight: 700, fontSize: 16,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(12,108,156,0.25)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
