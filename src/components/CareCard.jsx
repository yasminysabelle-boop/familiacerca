import { Heart, Pill, Calendar, Users } from './Icons'

const TEAL            = '#087F70'
const TEAL_LIGHT       = '#A8E5D6'
const CORAL_EMERGENCY  = '#D9534F'
const CORAL_HEART      = '#F5836E'
const GOLD             = '#D99A18'

const SERIF = "'Fraunces', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

const STATUS = {
  ok:       { label: 'Todo bajo control',    dot: '#7BE0A0', glow: 'rgba(123,224,160,.28)' },
  warning:  { label: 'Atención necesaria',   dot: '#FBBF24', glow: 'rgba(251,191,36,.28)' },
  critical: { label: 'Requiere seguimiento', dot: CORAL_EMERGENCY, glow: 'rgba(217,83,79,.28)' },
}

function StatItem({ icon, label, sub, last = false, onClick }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5, cursor: onClick ? 'pointer' : 'default' }}
      >
        <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        <span style={{ minWidth: 0, color: '#fff', fontSize: 10, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em', fontFamily: SANS }}>
          {label}<br /><span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.8)' }}>{sub}</span>
        </span>
      </div>
      {!last && <div style={{ flex: 'none', width: 1, height: 32, background: 'rgba(255,255,255,0.16)', margin: '0 3px' }} />}
    </>
  )
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
  onMedsClick,
  onRoutineClick,
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
        borderRadius: 30,
        overflow: 'hidden',
        background: 'linear-gradient(148deg, #12A18C 0%, #0A8072 46%, #055C51 100%)',
        boxShadow: '0 22px 44px -18px rgba(6,90,80,0.6)',
        padding: '24px 18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Marca de agua — logo FamiliaCerca (corazón + 2 personas) */}
      <svg width="230" height="230" viewBox="0 0 100 100" style={{ position: 'absolute', right: -38, top: 6, opacity: 0.12, pointerEvents: 'none' }} fill="#fff">
        <path d="M50 88C22 68 8 54 8 34 8 22 17 13 29 13c8 0 15 5 21 13 6-8 13-13 21-13 12 0 21 9 21 21 0 20-14 34-42 54Z" />
        <circle cx="40" cy="40" r="7" fill="#055C51" /><path d="M28 62c0-8 5-13 12-13s12 5 12 13Z" fill="#055C51" />
        <circle cx="60" cy="45" r="5.5" fill="#0A8072" /><path d="M50 62c0-7 4-11 10-11s10 4 10 11Z" fill="#0A8072" />
      </svg>
      {/* Menú de puntos decorativo */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={{ position: 'absolute', right: 18, top: 20, opacity: 0.5 }}>
        <circle cx="8" cy="6" r="1.7" /><circle cx="16" cy="6" r="1.7" />
        <circle cx="8" cy="12" r="1.7" /><circle cx="16" cy="12" r="1.7" />
        <circle cx="8" cy="18" r="1.7" /><circle cx="16" cy="18" r="1.7" />
      </svg>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Foto circular + nombre */}
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{
            flex: 'none', width: 106, height: 106, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.55)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
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
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 31, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1 }}>
                {name}
              </h2>
              <Heart size={24} color={CORAL_HEART} filled />
            </div>
            <p style={{ margin: '9px 0 0', fontFamily: SANS, fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.94)', lineHeight: 1.32, maxWidth: 200 }}>
              {moodText || defaultMood}
            </p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content',
              marginTop: 13, padding: '6px 13px 6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)',
            }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot, boxShadow: `0 0 0 4px ${s.glow}` }} />
              <span style={{ fontFamily: SANS, color: '#fff', fontSize: 14, fontWeight: 600 }}>{s.label}</span>
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.16)', margin: '20px 0 16px' }} />

        {/* 3 stats en columnas */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatItem
            icon={<Pill size={16} color={TEAL} strokeWidth={2} />}
            label="Medicamentos"
            sub={medsUpToDate ? 'al día' : 'pendiente'}
            onClick={onMedsClick ? (e) => { e.stopPropagation(); onMedsClick() } : undefined}
          />
          <StatItem
            icon={<Calendar size={15} color={TEAL} strokeWidth={2} />}
            label="Rutina"
            sub={routineUpToDate ? 'al día' : 'pendiente'}
            onClick={onRoutineClick ? (e) => { e.stopPropagation(); onRoutineClick() } : undefined}
          />
          <StatItem
            icon={<Users size={16} color={TEAL} strokeWidth={1.9} />}
            label="Familia"
            sub={familyCount > 0 ? `${familyCount} conectado${familyCount === 1 ? '' : 's'}` : 'sin conectar'}
            onClick={onFamilyClick ? (e) => { e.stopPropagation(); onFamilyClick() } : undefined}
            last
          />
        </div>
      </div>
    </div>
  )
}
