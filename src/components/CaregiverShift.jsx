import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getLocation } from '../lib/gps'
import { track } from '../lib/analytics'

// Turnos del cuidador (nov 2026): quien cuida marca "Llegué" y "Me voy".
// La familia ve cuántas horas hubo esta semana, sin tener que preguntar.
// compact: solo el botón de turno (para Inicio del cuidador).

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const hm = d => new Date(d).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true })
const day = d => new Date(d).toLocaleDateString('es', { weekday: 'short', day: 'numeric' })
const hoursOf = s => ((s.check_out_at ? new Date(s.check_out_at) : new Date()) - new Date(s.check_in_at)) / 3600000
const fmtH = h => { const t = Math.round(h * 60); const H = Math.floor(t / 60), M = t % 60; return H ? `${H} h${M ? ` ${M} min` : ''}` : `${M} min` }

export default function CaregiverShift({ ownerId, compact = false, canClock = true }) {
  const { user } = useAuth()
  const me = (user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Yo').split(' ')[0]
  const [shifts, setShifts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [note, setNote] = useState('')

  async function load() {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase.from('caregiver_shifts').select('*')
      .eq('user_id', ownerId).gte('check_in_at', since).order('check_in_at', { ascending: false })
    setShifts(error ? false : (data ?? []))
  }
  useEffect(() => { if (ownerId) load() }, [ownerId])

  if (shifts === false || shifts === null) return null
  const mine = shifts.find(s => s.caregiver_id === user?.id && !s.check_out_at)
  if (compact && !canClock) return null
  if (!compact && shifts.length === 0 && !canClock) return null

  async function checkIn() {
    setBusy(true)
    const loc = await getLocation({ force: true }).catch(() => null)
    await supabase.from('caregiver_shifts').insert({
      user_id: ownerId, caregiver_name: me,
      in_lat: loc?.latitude ?? null, in_lng: loc?.longitude ?? null, in_address: loc?.address ?? null,
    })
    track('shift_check_in')
    setBusy(false); load()
  }
  async function checkOut() {
    setBusy(true)
    await supabase.from('caregiver_shifts').update({ check_out_at: new Date().toISOString(), out_note: note.trim() || null }).eq('id', mine.id)
    track('shift_check_out', { with_note: !!note.trim() })
    setBusy(false); setLeaving(false); setNote(''); load()
  }

  const btn = (bg, color, border) => ({ width: '100%', padding: 14, borderRadius: 14, border: border || 'none', background: bg, color, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: SANS })

  const clock = canClock && (
    mine ? (
      leaving ? (
        <div>
          <label style={{ display: 'block', fontSize: 15, color: '#14303D', fontWeight: 700, marginBottom: 6 }}>¿Algo que la familia deba saber? (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ej: comió poco, durmió la siesta, falta crema"
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #E6E3DB', fontSize: 16, fontFamily: SANS, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setLeaving(false)} style={{ ...btn('white', '#4E6470', '1.5px solid #E6E3DB'), flex: 1 }}>Volver</button>
            <button onClick={checkOut} disabled={busy} style={{ ...btn('#0C6C9C', 'white'), flex: 1 }}>{busy ? 'Guardando…' : 'Terminar turno'}</button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 15, color: '#14303D' }}>
            ✅ Estás de turno desde las <strong>{hm(mine.check_in_at)}</strong> ({fmtH(hoursOf(mine))})
          </p>
          <button onClick={() => setLeaving(true)} style={btn('white', '#0C6C9C', '1.5px solid #0C6C9C')}>Me voy</button>
        </div>
      )
    ) : (
      <button onClick={checkIn} disabled={busy} style={btn('#0C6C9C', 'white')}>{busy ? 'Marcando…' : '👋 Llegué, empiezo mi turno'}</button>
    )
  )

  if (compact) {
    return (
      <section aria-label="Mi turno" style={{ marginTop: 14, background: 'white', borderRadius: 20, padding: 16, border: '1px solid #E6E3DB', fontFamily: SANS }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#14303D' }}>Mi turno</h2>
        {clock}
      </section>
    )
  }

  // Horas por persona esta semana
  const byPerson = {}
  for (const s of shifts) {
    const k = s.caregiver_name || 'Sin nombre'
    byPerson[k] = (byPerson[k] ?? 0) + hoursOf(s)
  }
  const onNow = shifts.filter(s => !s.check_out_at)

  return (
    <section aria-label="Turnos de cuidado" style={{ background: 'white', borderRadius: 20, border: '1px solid #E6E3DB', padding: 18, marginBottom: 12, fontFamily: SANS }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#14303D' }}>Turnos de cuidado</h2>
      <p style={{ margin: '4px 0 14px', fontSize: 15, color: '#4E6470', lineHeight: 1.45 }}>
        Quien cuida marca cuando llega y cuando se va. Útil si pagan a una cuidadora o se turnan entre hermanos.
      </p>
      {onNow.length > 0 && (
        <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, background: '#EEF6FA', fontSize: 15, color: '#14303D' }}>
          Ahora cuidando: <strong>{onNow.map(s => s.caregiver_name).join(', ')}</strong> (desde las {hm(onNow[0].check_in_at)})
        </p>
      )}
      {clock && <div style={{ marginBottom: 14 }}>{clock}</div>}
      {Object.keys(byPerson).length > 0 && (
        <>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#14303D' }}>Horas en los últimos 7 días</h3>
          {Object.entries(byPerson).sort((a, b) => b[1] - a[1]).map(([n, h]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#14303D', padding: '6px 0' }}>
              <span style={{ fontWeight: 700 }}>{n}</span><span>{fmtH(h)}</span>
            </div>
          ))}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#0C6C9C', padding: '6px 0' }}>Ver cada turno</summary>
            {shifts.map(s => (
              <div key={s.id} style={{ padding: '8px 0', borderTop: '1px solid #F0EEE8', fontSize: 15, color: '#14303D' }}>
                <strong>{s.caregiver_name}</strong> · {day(s.check_in_at)}, {hm(s.check_in_at)} – {s.check_out_at ? hm(s.check_out_at) : 'ahora'} ({fmtH(hoursOf(s))})
                {s.out_note && <div style={{ color: '#4E6470', marginTop: 2 }}>“{s.out_note}”</div>}
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  )
}
