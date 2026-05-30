import { useFamily } from '../contexts/FamilyContext'

export default function FamilySelector() {
  const { families, switchFamily, needsSelector } = useFamily()
  if (!needsSelector) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#F7F3ED',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '0 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>👨‍👩‍👧</div>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
            color: '#1A1A1A', margin: '0 0 8px',
          }}>
            ¿A qué familia quieres entrar?
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            Tienes acceso a más de una familia
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {families.map(fam => {
            const initials = fam.patientName?.charAt(0)?.toUpperCase() ?? '?'
            const roleLabel = fam.role === null ? 'Eres el admin' : fam.role === 'cuidador' ? 'Eres cuidador' : 'Eres familiar'
            const roleColor = fam.role === null ? '#4A7C59' : fam.role === 'cuidador' ? '#2563EB' : '#6B7280'
            const roleBg = fam.role === null ? '#EBF3EE' : fam.role === 'cuidador' ? '#DBEAFE' : '#F3F4F6'
            return (
              <button
                key={fam.ownerId}
                onClick={() => switchFamily(fam.ownerId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'white', border: '1.5px solid #EDE5D8',
                  borderRadius: 20, padding: '16px 18px',
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                {fam.patientPhotoUrl ? (
                  <img
                    src={fam.patientPhotoUrl} alt={fam.patientName}
                    style={{
                      width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid #EDE5D8', flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #4A7C59, #2D6A4F)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, color: 'white',
                  }}>
                    {initials}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 16, fontWeight: 700, color: '#1A1A1A',
                    margin: '0 0 6px', fontFamily: 'Georgia, serif',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fam.patientName ?? 'Mi familia'}
                  </p>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: roleColor, background: roleBg,
                    padding: '3px 10px', borderRadius: 6,
                  }}>
                    {roleLabel}
                  </span>
                </div>
                <span style={{ color: '#D1D5DB', fontSize: 22, flexShrink: 0 }}>›</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
