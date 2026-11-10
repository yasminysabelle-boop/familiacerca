import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// "Esta semana, quién hizo qué" (nov 2026): muestra cómo se repartió el cuidado
// en los últimos 7 días, para aliviar a quien carga más sin tener que pelear.
// Cuenta medicinas dadas, cuidados marcados, tareas hechas y gastos pagados.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const SKIP = new Set(['sistema automático', 'sistema automatico', ''])

const key = n => (n || '').trim().split(' ')[0].toLowerCase()
const label = n => { const f = (n || '').trim().split(' ')[0]; return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : '' }

export default function WeeklyContributions({ ownerId }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!ownerId) return
    let off = false
    ;(async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      const sinceIso = since.toISOString()
      const sinceDate = since.toLocaleDateString('en-CA')
      const [meds, care, tasks, exp] = await Promise.all([
        supabase.from('medication_logs').select('confirmed_by_name').eq('user_id', ownerId).eq('status', 'confirmed').gte('confirmed_at', sinceIso),
        supabase.from('daily_care_logs').select('checked_by, status').eq('user_id', ownerId).gte('log_date', sinceDate),
        supabase.from('family_tasks').select('done_by_name').eq('user_id', ownerId).gte('done_at', sinceIso),
        supabase.from('care_expenses').select('paid_by, amount').eq('user_id', ownerId).gte('date', sinceDate),
      ])
      const map = {}
      const add = (name, field, n = 1) => {
        const k = key(name)
        if (SKIP.has(k)) return
        map[k] ??= { name: label(name), meds: 0, care: 0, tasks: 0, money: 0 }
        map[k][field] += n
      }
      ;(meds.data ?? []).forEach(r => add(r.confirmed_by_name, 'meds'))
      ;(care.data ?? []).filter(r => r.status !== 'no_completado').forEach(r => add(r.checked_by, 'care'))
      ;(tasks.data ?? []).forEach(r => add(r.done_by_name, 'tasks'))
      ;(exp.data ?? []).forEach(r => add(r.paid_by, 'money', parseFloat(r.amount) || 0))
      const list = Object.values(map)
        .map(r => ({ ...r, total: r.meds + r.care + r.tasks + (r.money > 0 ? 1 : 0) }))
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total)
      if (!off) setRows(list)
    })()
    return () => { off = true }
  }, [ownerId])

  if (!rows || rows.length === 0) return null

  const max = rows[0].total
  const sum = rows.reduce((a, r) => a + r.total, 0)
  const top = rows[0]
  const carga = rows.length > 1 && top.total / sum >= 0.7

  const detail = r => [
    r.meds && `${r.meds} ${r.meds === 1 ? 'medicina' : 'medicinas'}`,
    r.care && `${r.care} ${r.care === 1 ? 'cuidado' : 'cuidados'}`,
    r.tasks && `${r.tasks} ${r.tasks === 1 ? 'tarea' : 'tareas'}`,
    r.money > 0 && `$${r.money.toFixed(2)} en gastos`,
  ].filter(Boolean).join(' · ')

  return (
    <section aria-label="Quién hizo qué esta semana" style={{ background: 'white', borderRadius: 20, border: '1px solid #E6E3DB', padding: 18, marginBottom: 12, fontFamily: SANS }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#14303D' }}>Esta semana, quién hizo qué</h2>
      <p style={{ margin: '4px 0 14px', fontSize: 15, color: '#4E6470' }}>Así se repartió el cuidado en los últimos 7 días. Gracias a todos 💙</p>
      {rows.map(r => (
        <div key={r.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#14303D' }}>{r.name}</span>
            <span style={{ fontSize: 14, color: '#4E6470', textAlign: 'right' }}>{detail(r)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: '#EEF6FA', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(6, (r.total / max) * 100)}%`, height: '100%', borderRadius: 6, background: '#0C6C9C' }} />
          </div>
        </div>
      ))}
      {carga && (
        <p style={{ margin: '6px 0 0', padding: '12px 14px', borderRadius: 14, background: '#FBEAE4', fontSize: 15, color: '#8A3A2A', lineHeight: 1.45 }}>
          {top.name} hizo la mayor parte esta semana. ¿Alguien puede tomar una tarea, aunque sea desde lejos?
        </p>
      )}
    </section>
  )
}
