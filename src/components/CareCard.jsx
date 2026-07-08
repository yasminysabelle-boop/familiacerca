import { Heart } from './Icons'

const TEAL            = '#087F70'
const TEAL_LIGHT       = '#A8E5D6'
const CORAL_EMERGENCY  = '#D9534F'
const GOLD             = '#D99A18'

const SERIF = "'Fraunces', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

const STATUS = {
  ok:       { emoji: '✅', label: 'Todo bajo control',    color: TEAL },
  warning:  { emoji: '🟡', label: 'Atención necesaria',   color: GOLD },
  critical: { emoji: '🔴', label: 'Requiere seguimiento', color: CORAL_EMERGENCY },
}

// CareCard — tarjeta genérica de familiar/paciente (paleta de marca app)
export default function CareCard({
  name,
  photoUrl,
  moodText,
  status = 'ok',
  medsUpToDate = true,
  routineUpToDate = true,
  familyCount = 0,
  onClick,
  onFamilyClick,
}) {
  const s = STATUS[status] ?? STATUS.ok
  const defaultMood =
    status === 'critical' ? `${name} necesita atención pronto.` :
    status === 'warning'  ? `Hoy ${name} necesita un poco más de atención.` :
    `Hoy ${name} está tranquila y de buen ánimo.`

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        background: 'linear-gradient(148deg, #12A18C 0%, #0A8072 46%, #055C51 100%)',
        padding: '28px 24px',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Marca de agua — corazón grande y sutil */}
      <div style={{ position: 'absolute', top: -44, right: -44, opacity: 0.22, pointerEvents: 'none' }}>
        <Heart size={200} color="white" filled />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Foto circular + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '22px', flexShrink: 0,
            border: '3px solid rgba(255,255,255,0.85)',
            overflow: 'hidden', background: photoUrl ? 'rgba(255,255,255,0.25)' : 'rgba(8,127,112,0.90)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <span style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                {(name?.charAt(0) || '?').toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>
                {name}
              </h2>
              <Heart size={18} color="white" filled />
            </div>
            <p style={{ margin: '4px 0 0', fontFamily: SANS, fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.4 }}>
              {moodText || defaultMood}
            </p>
          </div>
        </div>

        {/* Estado emocional — texto humano, no porcentaje */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content',
          padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.92)',
          fontFamily: SANS, fontSize: 12, fontWeight: 700, color: s.color,
        }}>
          <span>{s.emoji}</span> {s.label}
        </span>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <p style={{ margin: 0, fontFamily: SANS, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ opacity: medsUpToDate ? 1 : 0.45 }}>✓</span> Medicamentos al día
          </p>
          <p style={{ margin: 0, fontFamily: SANS, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ opacity: routineUpToDate ? 1 : 0.45 }}>✓</span> Rutina al día
          </p>
          <p
            onClick={onFamilyClick ? (e) => { e.stopPropagation(); onFamilyClick() } : undefined}
            style={{ margin: 0, fontFamily: SANS, fontSize: 13, color: 'white', display: 'flex', alignItems: 'center', gap: 7, cursor: onFamilyClick ? 'pointer' : 'inherit', width: 'fit-content' }}
          >
            <span>👥</span> {familyCount} familiar{familyCount === 1 ? '' : 'es'} conectado{familyCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </div>
  )
}
