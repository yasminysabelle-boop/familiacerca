import { useNavigate } from 'react-router-dom'

// "¿Cómo está hoy?" — una sola puerta para todo lo que la familia escribe
// sobre el familiar. Antes había 5 entradas sueltas en los menús (Notas,
// Notas de la familia, Memorias de voz, Notas médicas, Estado de salud) y la
// gente no sabía dónde poner cada cosa (auditoría nov 2026). Esta hoja
// pregunta qué quieres guardar y lleva a la pantalla que ya existe: no se
// mueve ningún dato.

const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"
const SERIF = "'Fraunces', Georgia, serif"

const OPTIONS = [
  { emoji: '🍽️', title: 'Cómo comió, durmió y su ánimo', sub: 'Un registro rápido de cómo está hoy', to: '/registros' },
  { emoji: '📝', title: 'Algo que pasó hoy',             sub: 'Una novedad o algo que la familia deba saber', to: '/notes?add=1' },
  { emoji: '🎙️', title: 'Grabar una nota de voz',       sub: 'Habla y se convierte en texto', to: '/paciente/notas-familia' },
  { emoji: '🩺', title: 'Lo que dijo el médico',         sub: 'Indicaciones o una receta; Milo lo organiza', to: '/diario-medico' },
]

export default function HowIsTodaySheet({ open, onClose, patientName }) {
  const navigate = useNavigate()
  if (!open) return null
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ width: '100%', maxWidth: 520, background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '20px 16px 28px', fontFamily: SANS, boxShadow: '0 -12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: '#E5E0D8', margin: '0 auto 16px' }} />
        <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: '#14303D', margin: '0 0 4px' }}>
          ¿Cómo está {patientName || 'tu familiar'} hoy?
        </p>
        <p style={{ fontSize: 14, color: '#4E6470', margin: '0 0 16px' }}>¿Qué quieres guardar?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map(o => (
            <button
              key={o.to}
              onClick={() => { onClose(); navigate(o.to) }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, padding: '12px 14px', borderRadius: 16, border: '1.5px solid #E6E3DB', background: '#FBF8F3', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">{o.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#14303D' }}>{o.title}</span>
                <span style={{ display: 'block', fontSize: 14, color: '#4E6470', marginTop: 2 }}>{o.sub}</span>
              </span>
              <span style={{ color: '#0C6C9C', fontSize: 20, flexShrink: 0 }} aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 14, padding: 12, border: 'none', background: 'none', fontSize: 15, color: '#4E6470', cursor: 'pointer' }}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
