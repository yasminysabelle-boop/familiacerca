import { Pill } from './Icons'

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQ_LABELS = {
  once_daily:  'Una vez al día',
  twice_daily: 'Dos veces al día',
  three_daily: 'Tres veces al día',
  every_4h:    'Cada 4 horas',
  every_6h:    'Cada 6 horas',
  every_8h:    'Cada 8 horas',
  every_12h:   'Cada 12 horas',
  as_needed:   'Según necesidad',
  weekly:      'Semanal',
}

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

// ── Component ─────────────────────────────────────────────────────────────────
// Tarjetas de solo lectura — tocar abre el Detalle (edición/pausa/eliminación viven ahí)

export default function MedicationListTab({ medications = [], onOpenDetail }) {
  if (medications.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>💊</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1E2C3A', fontFamily: SANS }}>Sin medicamentos aún</p>
        <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: SANS }}>Agrega medicamentos desde el botón + de arriba.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0 96px' }}>
      <p style={{ fontSize: 13, color: '#6B7A88', marginBottom: 14, fontFamily: SANS }}>
        {medications.length} medicamento{medications.length !== 1 ? 's' : ''} registrado{medications.length !== 1 ? 's' : ''}. Toca una tarjeta para ver el detalle.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {medications.map(med => {
          const freqLabel = FREQ_LABELS[med.frequency] ?? med.frequency ?? null
          const subtitle = [freqLabel, med.notes].filter(Boolean).join(' · ')
          return (
            <button
              key={med.id}
              onClick={() => onOpenDetail(med)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#FFFFFF', borderRadius: 20, padding: 16,
                boxShadow: '0 6px 14px -8px #087F7033',
                fontFamily: SANS, WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Pill size={20} color="#08554A" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1E2C3A' }}>
                  {med.name}{med.dosage ? ` ${med.dosage}` : ''}
                </div>
                {subtitle && (
                  <div style={{ fontSize: 13, color: '#6B7A88', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
                )}
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B7C0C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
