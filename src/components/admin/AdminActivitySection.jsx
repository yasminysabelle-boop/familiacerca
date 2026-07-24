import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFamily } from '../../contexts/FamilyContext'

const SINCE = new Date(Date.now() - 30 * 86400000).toISOString()

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60)   return 'Ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days < 7)   return `hace ${days}d`
  return new Date(isoStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const TYPE_META = {
  med_confirmed:  { icon: '💊', color: '#087F70', label: 'Medicamento confirmado' },
  note_added:     { icon: '📝', color: '#2D86A0', label: 'Nota agregada' },
  voice_memo:     { icon: '🎙️', color: '#7C5CBF', label: 'Memoria de voz' },
  expense_added:  { icon: '💰', color: '#C9882A', label: 'Gasto registrado' },
  hospital_doc:   { icon: '📁', color: '#B91C1C', label: 'Documento subido' },
  visit_added:    { icon: '👥', color: '#087F70', label: 'Visita anotada' },
  videocall:      { icon: '📹', color: '#1D4ED8', label: 'Videollamada programada' },
}

export default function AdminActivitySection() {
  const { ownerId } = useFamily()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    load()
  }, [ownerId])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: medLogs },
        { data: notesData },
        { data: diary },
        { data: expensesData },
        { data: hospdocs },
        { data: visits },
        { data: videocalls },
      ] = await Promise.all([
        supabase.from('medication_logs')
          .select('id, confirmed_at, confirmed_by_name, status, medications(name)')
          .eq('user_id', ownerId).eq('status', 'confirmed')
          .gte('confirmed_at', SINCE)
          .order('confirmed_at', { ascending: false }).limit(30),
        supabase.from('notes')
          .select('id, created_at, title, creator:user_profiles!created_by_user_id(full_name)')
          .eq('user_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('voice_diary')
          .select('id, created_at, title, author:user_profiles!user_id(full_name)')
          .eq('user_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('care_expenses')
          .select('id, created_at, description, amount, category, paid_by')
          .eq('user_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('hospital_documents')
          .select('id, created_at, title, document_type, author:user_profiles!created_by(full_name)')
          .eq('owner_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('hospital_visits')
          .select('id, created_at, visitor_name, creator:user_profiles!created_by(full_name)')
          .eq('owner_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(15),
        supabase.from('video_calls')
          .select('id, created_at, title, scheduled_at, created_by_name')
          .eq('owner_id', ownerId)
          .gte('created_at', SINCE)
          .order('created_at', { ascending: false }).limit(10),
      ])

      const all = [
        ...(medLogs ?? []).map(l => ({
          id: `med-${l.id}`, ts: l.confirmed_at, type: 'med_confirmed',
          who: l.confirmed_by_name ?? 'Cuidador',
          what: `${l.medications?.name ?? 'Medicamento'} marcado como dado`,
        })),
        ...(notesData ?? []).map(n => ({
          id: `note-${n.id}`, ts: n.created_at, type: 'note_added',
          who: n.creator?.full_name ?? 'Familiar',
          what: n.title ? `"${n.title}"` : 'Nota sin título',
        })),
        ...(diary ?? []).map(d => ({
          id: `diary-${d.id}`, ts: d.created_at, type: 'voice_memo',
          who: d.author?.full_name ?? 'Familiar',
          what: d.title ?? 'Memoria de voz',
        })),
        ...(expensesData ?? []).map(e => ({
          id: `exp-${e.id}`, ts: e.created_at, type: 'expense_added',
          who: e.paid_by ?? 'Familiar',
          what: `${e.category}${e.description ? ` — ${e.description}` : ''} · $${Number(e.amount).toLocaleString('es-MX')}`,
        })),
        ...(hospdocs ?? []).map(d => ({
          id: `hdoc-${d.id}`, ts: d.created_at, type: 'hospital_doc',
          who: d.author?.full_name ?? 'Familiar',
          what: `${d.title} (${d.document_type ?? 'documento'})`,
        })),
        ...(visits ?? []).map(v => ({
          id: `visit-${v.id}`, ts: v.created_at, type: 'visit_added',
          who: v.creator?.full_name ?? 'Familiar',
          what: `${v.visitor_name} anotado como visitante`,
        })),
        ...(videocalls ?? []).map(c => ({
          id: `vc-${c.id}`, ts: c.created_at, type: 'videocall',
          who: c.created_by_name ?? 'Admin',
          what: `${c.title} — ${new Date(c.scheduled_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
        })),
      ]

      all.sort((a, b) => new Date(b.ts) - new Date(a.ts))
      setEvents(all.slice(0, 60))
    } catch (err) {
      console.error('[AdminActivitySection]', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 24 }}>Cargando actividad...</p>

  if (events.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <p style={{ fontSize: 32 }}>📋</p>
      <p style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Sin actividad en los últimos 30 días.</p>
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 2px' }}>
        Últimos 30 días ({events.length} eventos)
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {events.map((ev, i) => {
          const meta = TYPE_META[ev.type] ?? { icon: '•', color: '#9CA3AF', label: ev.type }
          const showDate = i === 0 || new Date(events[i - 1].ts).toDateString() !== new Date(ev.ts).toDateString()
          return (
            <div key={ev.id}>
              {showDate && (
                <p style={{
                  fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  margin: i === 0 ? '0 0 8px' : '16px 0 8px',
                }}>
                  {new Date(ev.ts).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              )}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                background: 'white', border: '1px solid #F8F4ED',
                marginBottom: 6,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: meta.color + '12',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
                    {ev.what}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    {ev.who} · {timeAgo(ev.ts)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
