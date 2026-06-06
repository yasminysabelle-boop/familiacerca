import { useFamily } from '../contexts/FamilyContext'

export default function FamilySelector() {
  const { families, switchFamily, needsSelector } = useFamily()
  if (!needsSelector) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: '#F5F0E8',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 20px 40px',
      overflowY: 'auto',
    }}>
      {/* FC Logo */}
      <svg width={64} height={64} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="20" cy="20" r="20" fill="#4A7C59" />
        <circle cx="20" cy="20" r="17.5" fill="white" />
        <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle"
          fill="#4A7C59" fontSize="14" fontWeight="800"
          fontFamily="Georgia, serif" letterSpacing="-0.5">FC</text>
        <text x="20" y="31" textAnchor="middle" dominantBaseline="middle"
          fill="#4A7C59" fillOpacity="0.72" fontSize="10">♥</text>
      </svg>

      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 26, fontWeight: 700, color: '#1A1A1A',
        textAlign: 'center', marginTop: 20, marginBottom: 6, lineHeight: 1.25,
      }}>
        ¿A quién vas a<br />cuidar hoy?
      </p>
      <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', margin: '0 0 32px' }}>
        Selecciona un grupo familiar
      </p>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {families.map(fam => {
          const isAdmin  = fam.role === null
          const isCuidad = fam.role === 'cuidador'
          const roleLabel = isAdmin ? 'Administrador' : isCuidad ? 'Cuidador' : 'Familiar'
          const roleColor = isAdmin ? '#3D6B54' : isCuidad ? '#1D4ED8' : '#D97706'
          const roleBg    = isAdmin ? '#E8F5EE'  : isCuidad ? '#EFF6FF' : '#FEF3C7'
          const initial   = (fam.patientName ?? 'F').charAt(0).toUpperCase()

          return (
            <button
              key={fam.ownerId}
              onClick={() => switchFamily(fam.ownerId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px', borderRadius: 16,
                background: 'white', border: '1.5px solid #EDE5D8',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                textAlign: 'left', width: '100%',
              }}
            >
              {fam.patientPhotoUrl ? (
                <img
                  src={fam.patientPhotoUrl} alt={fam.patientName}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #EDE5D8' }}
                />
              ) : (
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4A7C59, #2D6A4F)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700, color: 'white',
                }}>
                  {initial}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 16, fontWeight: 600, color: '#1A1A1A',
                  margin: 0, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {fam.patientName ?? 'Mi familiar'}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: 5,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  color: roleColor, background: roleBg,
                  padding: '3px 8px', borderRadius: 6,
                }}>
                  {roleLabel}
                </span>
              </div>

              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#C5B9A8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
