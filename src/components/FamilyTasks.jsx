import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { track } from '../lib/analytics'

// Tareas de la familia (nov 2026): repartir el cuidado entre todos, también
// con quien vive en otro país. Cada quien toma una tarea ("Lo hago yo") y la
// marca cuando la termina. Las que se pueden hacer a distancia llevan 🌎.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

const SUGGESTIONS = [
  { title: 'Pedir la próxima cita del médico', remote: true },
  { title: 'Llamar a la farmacia para pedir la receta', remote: true },
  { title: 'Pagar la luz o el agua', remote: true },
  { title: 'Hacer una videollamada para acompañar', remote: true },
  { title: 'Comprar insumos (pañales, guantes, cremas)', remote: false },
  { title: 'Llevar a la cita del médico', remote: false },
]

function firstName(user) {
  const n = user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Yo'
  return n.split(' ')[0]
}

export default function FamilyTasks({ ownerId }) {
  const { user } = useAuth()
  const me = firstName(user)
  const [tasks, setTasks] = useState([])
  const [available, setAvailable] = useState(true)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [remote, setRemote] = useState(false)
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(null)
  const [showDone, setShowDone] = useState(false)

  async function load() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase
      .from('family_tasks')
      .select('*')
      .eq('user_id', ownerId)
      .or(`done_at.is.null,done_at.gte.${weekAgo}`)
      .order('created_at', { ascending: true })
    if (error) { setAvailable(false); return }
    setTasks(data ?? [])
  }

  useEffect(() => { if (ownerId) load() }, [ownerId])

  async function addTask() {
    const t = title.trim()
    if (!t) return
    setBusy('new')
    const { error } = await supabase.from('family_tasks').insert({
      user_id: ownerId, title: t, remote_ok: remote, due_date: due || null,
    })
    setBusy(null)
    if (!error) {
      track('family_task_created', { remote })
      setTitle(''); setRemote(false); setDue(''); setAdding(false)
      load()
    }
  }

  async function take(task) {
    setBusy(task.id)
    await supabase.from('family_tasks').update({ assigned_to: user.id, assigned_name: me }).eq('id', task.id)
    setBusy(null); load()
  }

  async function done(task) {
    setBusy(task.id)
    await supabase.from('family_tasks').update({
      done_at: new Date().toISOString(), done_by: user.id, done_by_name: me,
      ...(task.assigned_to ? {} : { assigned_to: user.id, assigned_name: me }),
    }).eq('id', task.id)
    track('family_task_done', { remote: task.remote_ok })
    setBusy(null); load()
  }

  async function remove(task) {
    setBusy(task.id)
    await supabase.from('family_tasks').delete().eq('id', task.id)
    setBusy(null); load()
  }

  if (!available) return null

  const open = tasks.filter(t => !t.done_at)
  const finished = tasks.filter(t => t.done_at)
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid #E6E3DB', borderRadius: 12, fontSize: 16, boxSizing: 'border-box', fontFamily: SANS, color: '#14303D' }
  const fmtDue = d => new Date(d + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <section aria-label="Tareas de la familia" style={{ background: 'white', borderRadius: 20, border: '1px solid #E6E3DB', padding: 18, marginBottom: 12, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#14303D' }}>Tareas de la familia</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #0C6C9C', background: 'white', color: '#0C6C9C', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            + Agregar
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 15, color: '#4E6470', lineHeight: 1.45 }}>
        Repártanse el cuidado. Las tareas con 🌎 se pueden hacer desde otro país.
      </p>

      {adding && (
        <div style={{ background: '#F7F6F2', borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <input autoFocus placeholder="¿Qué hay que hacer?" value={title} onChange={e => setTitle(e.target.value)} style={{ ...field, marginBottom: 10 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {SUGGESTIONS.map(sg => (
              <button key={sg.title} onClick={() => { setTitle(sg.title); setRemote(sg.remote) }}
                style={{ padding: '7px 11px', borderRadius: 999, border: '1px solid #CDE8F3', background: 'white', color: '#0A4A6B', fontSize: 14, cursor: 'pointer' }}>
                {sg.remote ? '🌎 ' : ''}{sg.title}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: '#14303D', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} style={{ width: 22, height: 22 }} />
            🌎 Se puede hacer desde lejos
          </label>
          <label style={{ display: 'block', fontSize: 14, color: '#4E6470', marginBottom: 4 }}>¿Para cuándo? (opcional)</label>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...field, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setRemote(false); setDue('') }} style={{ flex: 1, padding: 13, borderRadius: 12, border: '1.5px solid #E6E3DB', background: 'white', color: '#4E6470', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={addTask} disabled={!title.trim() || busy === 'new'} style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: title.trim() ? '#0C6C9C' : '#C9D6DB', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {busy === 'new' ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {open.length === 0 && !adding && (
        <p style={{ margin: 0, padding: '14px', borderRadius: 14, background: '#F7F6F2', fontSize: 15, color: '#4E6470' }}>
          No hay tareas pendientes. Agrega una y quien pueda, la toma.
        </p>
      )}

      {open.map(t => {
        const mine = t.assigned_to === user?.id
        return (
          <div key={t.id} style={{ border: '1px solid #E6E3DB', borderRadius: 14, padding: '12px 14px', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700, color: '#14303D', lineHeight: 1.35 }}>
                {t.remote_ok && <span title="Se puede hacer desde lejos">🌎 </span>}{t.title}
              </p>
              {t.created_by === user?.id && (
                <button aria-label="Quitar tarea" onClick={() => remove(t)} style={{ background: 'none', border: 'none', color: '#5E7480', fontSize: 20, cursor: 'pointer', padding: '0 4px', minHeight: 32 }}>×</button>
              )}
            </div>
            <p style={{ margin: '4px 0 10px', fontSize: 14, color: '#4E6470' }}>
              {t.assigned_name ? `Lo hace: ${mine ? 'tú' : t.assigned_name}` : 'Nadie la ha tomado todavía'}
              {t.due_date ? ` · Para el ${fmtDue(t.due_date)}` : ''}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {!t.assigned_to && (
                <button onClick={() => take(t)} disabled={busy === t.id} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1.5px solid #0C6C9C', background: 'white', color: '#0C6C9C', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Lo hago yo
                </button>
              )}
              <button onClick={() => done(t)} disabled={busy === t.id} style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: '#0C6C9C', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Hecho
              </button>
            </div>
          </div>
        )
      })}

      {finished.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowDone(v => !v)} style={{ background: 'none', border: 'none', padding: '8px 0', fontSize: 15, fontWeight: 700, color: '#0C6C9C', cursor: 'pointer' }}>
            {showDone ? 'Ocultar' : `Hechas esta semana (${finished.length})`}
          </button>
          {showDone && finished.map(t => (
            <p key={t.id} style={{ margin: '6px 0 0', fontSize: 15, color: '#4E6470' }}>
              ✓ <span style={{ textDecoration: 'line-through' }}>{t.title}</span> · {t.done_by_name}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
