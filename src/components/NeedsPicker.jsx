import { useEffect, useRef, useState } from 'react'
import { NEEDS, saveNeeds } from '../lib/needs'
import { track } from '../lib/analytics'

// "¿Qué quieres tener a mano?" — se muestra una vez en Inicio y se puede
// cambiar cuando quieras. Lo que no se marca no desaparece: queda en
// "Todo el cuidado".

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

export default function NeedsPicker({ initial, onDone, onSkip, firstTime = false }) {
  const [sel, setSel] = useState(() => new Set(initial))
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (!firstTime) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [firstTime])

  function toggle(id) {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function done() {
    const ids = NEEDS.map(n => n.id).filter(id => sel.has(id))
    setSaving(true)
    await saveNeeds(ids)
    track('home_personalized', { count: ids.length, first_time: firstTime, needs: ids.join(',') })
    setSaving(false)
    onDone(ids)
  }

  return (
    <section ref={ref} aria-label="Personaliza tu Inicio" style={{ marginTop: 14, background: 'white', borderRadius: 20, padding: 18, border: '1.5px solid #0C6C9C', fontFamily: SANS }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#14303D' }}>
        {firstTime ? '¿Qué quieres tener a mano?' : 'Tu Inicio'}
      </h2>
      <p style={{ margin: '4px 0 14px', fontSize: 15, color: '#4E6470', lineHeight: 1.45 }}>
        Marca lo que usas. Lo demás no se pierde: sigue en "Ver todo el cuidado".
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {NEEDS.map(n => {
          const on = sel.has(n.id)
          return (
            <button key={n.id} onClick={() => toggle(n.id)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '11px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: SANS,
                border: on ? '2px solid #0C6C9C' : '1.5px solid #E6E3DB',
                background: on ? '#EEF6FA' : 'white',
              }}>
              <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{n.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#14303D' }}>{n.label}</span>
                <span style={{ display: 'block', fontSize: 14, color: '#4E6470', marginTop: 1 }}>{n.sub}</span>
              </span>
              <span aria-hidden="true" style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                border: on ? 'none' : '2px solid #C9D6DB', background: on ? '#0C6C9C' : 'white',
                color: 'white', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {onSkip && (
          <button onClick={onSkip} style={{ flex: 1, padding: 13, borderRadius: 12, border: '1.5px solid #E6E3DB', background: 'white', color: '#4E6470', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            {firstTime ? 'Ahora no' : 'Cancelar'}
          </button>
        )}
        <button onClick={done} disabled={saving || sel.size === 0} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: sel.size ? '#0C6C9C' : '#C9D6DB', color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: SANS }}>
          {saving ? 'Guardando…' : 'Listo'}
        </button>
      </div>
    </section>
  )
}
