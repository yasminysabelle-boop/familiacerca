import { useState } from 'react'
import { useFamily } from '../contexts/FamilyContext'
import { XIcon } from './Icons'

export default function FamilySwitcher() {
  const { families, activeOwnerId, switchFamily, activeFamilyLabel, hasMultiple } = useFamily()
  const [open, setOpen] = useState(false)

  if (!hasMultiple) return null

  const activeEntry = families.find(f => f.ownerId === activeOwnerId)
  const isOwn = activeEntry?.role === null
  const roleLabel = isOwn ? 'Tu familia' : activeEntry?.role === 'cuidador' ? 'Cuidador' : 'Familiar'
  const accentColor = isOwn ? '#4A7C59' : '#2563EB'
  const stripBg = isOwn ? '#FDF8F0' : '#EFF6FF'
  const stripBorder = isOwn ? '#EDE5D8' : '#BFDBFE'
  const btnBg = isOwn ? '#EBF3EE' : '#DBEAFE'

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: stripBg,
        borderBottom: `1px solid ${stripBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{isOwn ? '🏠' : '👁'}</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', lineHeight: 1.2 }}>
              {activeFamilyLabel}
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.2 }}>{roleLabel}</span>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            fontSize: 12, fontWeight: 700,
            color: accentColor, background: btnBg,
            border: 'none', borderRadius: 8,
            padding: '5px 10px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          Cambiar ↔
        </button>
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'white', borderRadius: '24px 24px 0 0',
              padding: '20px 20px 56px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                Cambiar familia
              </p>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <XIcon size={18} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {families.map(fam => {
                const isActive = fam.ownerId === activeOwnerId
                const initials = fam.patientName?.charAt(0)?.toUpperCase() ?? '?'
                const rl = fam.role === null ? 'Administrador' : fam.role === 'cuidador' ? 'Cuidador' : 'Familiar'
                const rc = fam.role === null ? '#4A7C59' : fam.role === 'cuidador' ? '#2563EB' : '#6B7280'
                const rb = fam.role === null ? '#EBF3EE' : fam.role === 'cuidador' ? '#DBEAFE' : '#F3F4F6'
                return (
                  <button
                    key={fam.ownerId}
                    onClick={() => { switchFamily(fam.ownerId); setOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 16,
                      border: `1.5px solid ${isActive ? '#4A7C59' : '#EDE5D8'}`,
                      background: isActive ? '#EBF3EE' : '#FDFAF7',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s', width: '100%',
                    }}
                  >
                    {fam.patientPhotoUrl ? (
                      <img
                        src={fam.patientPhotoUrl} alt={fam.patientName}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                          border: '2px solid #EDE5D8', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? 'linear-gradient(135deg, #4A7C59, #2D6A4F)' : '#E5E7EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700,
                        color: isActive ? 'white' : '#9CA3AF',
                      }}>
                        {initials}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 15, fontWeight: 700, color: '#1A1A1A',
                        margin: '0 0 4px', fontFamily: 'Georgia, serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {fam.patientName ?? 'Mi familia'}
                      </p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: rb, padding: '2px 8px', borderRadius: 5 }}>
                        {rl}
                      </span>
                    </div>
                    {isActive && <span style={{ color: '#4A7C59', fontSize: 18, flexShrink: 0 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
