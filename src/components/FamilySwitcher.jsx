import { useState } from 'react'
import { useFamily } from '../contexts/FamilyContext'
import { XIcon } from './Icons'

export default function FamilySwitcher({ isLight = false }) {
  const { families, activeOwnerId, switchFamily, activeFamilyLabel, activePatientName, hasMultiple } = useFamily()
  const [open, setOpen] = useState(false)

  const patientName = activePatientName || (activeFamilyLabel !== 'Mi familia' ? activeFamilyLabel : null)
  const displayLabel = patientName ? `Familia de ${patientName}` : 'Mi familia'

  if (!hasMultiple) {
    if (!patientName) return null
    return (
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: isLight ? '#6B7280' : 'rgba(255,255,255,0.65)',
        maxWidth: 110, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        display: 'block',
      }}>
        {displayLabel}
      </span>
    )
  }

  return (
    <>
      {/* Header trigger chip */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: isLight ? '#F3F4F6' : 'rgba(255,255,255,0.12)',
          border: isLight ? '1px solid #EDE5D8' : '1px solid rgba(255,255,255,0.18)',
          borderRadius: 20, padding: '5px 10px 5px 9px',
          cursor: 'pointer', maxWidth: 140,
          fontFamily: 'inherit',
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, color: isLight ? '#334155' : 'white',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}>
          {displayLabel}
        </span>
        <span style={{ fontSize: 7, color: isLight ? '#9CA3AF' : 'rgba(255,255,255,0.55)', flexShrink: 0, marginTop: 1 }}>▼</span>
      </button>

      {/* Sheet */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'white', borderRadius: '24px 24px 0 0',
              padding: '22px 20px 56px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 17, fontWeight: 700,
                color: '#1A1A1A', margin: 0,
              }}>
                Tus familias:
              </p>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
              >
                <XIcon size={18} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {families.map(fam => {
                const isActive = fam.ownerId === activeOwnerId
                const initials = fam.patientName?.charAt(0)?.toUpperCase() ?? '?'
                const roleLabel = fam.role === null ? 'Administrador' : fam.role === 'cuidador' ? 'Cuidador' : 'Familiar'
                const roleColor = fam.role === null ? '#087F70' : fam.role === 'cuidador' ? '#2563EB' : '#6B7280'
                const roleBg   = fam.role === null ? '#EBF3EE' : fam.role === 'cuidador' ? '#DBEAFE' : '#F3F4F6'

                return (
                  <div
                    key={fam.ownerId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 16,
                      border: `1.5px solid ${isActive ? '#087F70' : '#EDE5D8'}`,
                      background: isActive ? '#EBF3EE' : '#FDFAF7',
                    }}
                  >
                    {/* Avatar */}
                    {fam.patientPhotoUrl ? (
                      <img
                        src={fam.patientPhotoUrl} alt={fam.patientName}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                          border: '2px solid #EDE5D8', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? '#087F70' : '#E5E7EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700,
                        color: isActive ? 'white' : '#9CA3AF',
                      }}>
                        {initials}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 15, fontWeight: 700, color: '#1A1A1A',
                        margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {fam.patientName ?? 'Mi familia'}
                      </p>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: roleColor, background: roleBg,
                        padding: '2px 8px', borderRadius: 5,
                      }}>
                        Tu rol: {roleLabel}
                      </span>
                    </div>

                    {/* Action */}
                    {isActive ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#087F70',
                        flexShrink: 0,
                      }}>
                        ✓ Viendo
                      </span>
                    ) : (
                      <button
                        onClick={() => { switchFamily(fam.ownerId); setOpen(false) }}
                        style={{
                          padding: '8px 14px', borderRadius: 10,
                          background: '#087F70', color: 'white',
                          border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700,
                          flexShrink: 0, fontFamily: 'inherit',
                        }}
                      >
                        Ver →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
