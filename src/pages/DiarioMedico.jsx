import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import Layout from '../components/Layout'
import DiarioMedicoEntryModal from '../components/DiarioMedicoEntryModal'
import PaywallModal from '../components/PaywallModal'

const LOCATION_META = {
  hospital: { label: 'Hospital',  emoji: '🏥', bg: '#FFF0F0', color: '#B91C1C' },
  consulta: { label: 'Consulta',  emoji: '🏪', bg: '#EFF6FF', color: '#1D4ED8' },
  casa:     { label: 'Casa',      emoji: '🏠', bg: '#F0F9F4', color: '#15803D' },
  otro:     { label: 'Otro',      emoji: '📍', bg: '#F9F7F4', color: '#6B7280' },
}

const INPUT_META = {
  voice: { label: '🎙️ Voz', bg: '#F5F0FF', color: '#7C3AED' },
  photo: { label: '📷 Foto', bg: '#FFF7ED', color: '#C9882A' },
  text:  { label: '✏️ Texto', bg: '#F3F4F6', color: '#6B7280' },
}

function fmtDate(d, t) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  const dayStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = t ? ` · ${t.slice(0, 5)}` : ''
  return dayStr.charAt(0).toUpperCase() + dayStr.slice(1) + timeStr
}

function EntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const locMeta  = LOCATION_META[entry.location] ?? LOCATION_META.otro
  const inputMeta = INPUT_META[entry.input_type] ?? INPUT_META.text
  const hasMeds  = entry.medicamentos?.length > 0
  const hasSteps = entry.proximos_pasos?.length > 0

  return (
    <div style={{
      background: 'white', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8',
    }}>
      {/* Photo header */}
      {entry.photo_url && (
        <a href={entry.photo_url} target="_blank" rel="noopener noreferrer">
          <img
            src={entry.photo_url}
            alt="Documento médico"
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
          />
        </a>
      )}

      <div style={{ padding: '14px 16px' }}>
        {/* Top row: date, location, input type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: locMeta.bg, color: locMeta.color,
          }}>
            {locMeta.emoji} {locMeta.label}
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: inputMeta.bg, color: inputMeta.color,
          }}>
            {inputMeta.label}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>
            {fmtDate(entry.entry_date, entry.entry_time)}
          </span>
        </div>

        {/* Who recorded */}
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9CA3AF' }}>
          Registrado por <strong style={{ color: '#6B7280' }}>{entry.created_by_name ?? 'Familiar'}</strong>
        </p>

        {/* Estado general */}
        {entry.estado_general && (
          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.5 }}>
            {entry.estado_general}
          </p>
        )}

        {/* Doctor's notes */}
        {entry.que_dijo_el_medico && (
          <div style={{
            margin: '0 0 10px', padding: '10px 12px',
            borderRadius: 10, background: '#F9F7F4', border: '1px solid #EDE5D8',
          }}>
            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Médico indicó
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              {expanded || entry.que_dijo_el_medico.length < 100
                ? entry.que_dijo_el_medico
                : entry.que_dijo_el_medico.slice(0, 100) + '...'}
            </p>
          </div>
        )}

        {/* Medications */}
        {hasMeds && (
          <div style={{ margin: '0 0 10px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#4A7C59', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              💊 Medicamentos
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {entry.medicamentos.map((m, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: '#F0F9F4', color: '#1A5C35',
                  border: '1px solid #BBF7D0',
                }}>
                  {m.nombre}{m.dosis ? ` ${m.dosis}` : ''}{m.frecuencia ? ` · ${m.frecuencia}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Próximos pasos */}
        {hasSteps && (
          <div style={{ margin: '0 0 10px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#2D86A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              📋 Próximos pasos
            </p>
            {(expanded ? entry.proximos_pasos : entry.proximos_pasos.slice(0, 2)).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#2D86A0',
                  color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>{i + 1}</span>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Notes (expanded only) */}
        {expanded && entry.notas && (
          <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notas</p>
            <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>{entry.notas}</p>
          </div>
        )}

        {/* Raw transcript (expanded only) */}
        {expanded && entry.raw_transcript && (
          <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: '#F5F0FF', border: '1px solid #DDD6FE' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transcripción original</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic' }}>{entry.raw_transcript}</p>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4A7C59', fontSize: 12, fontWeight: 700, padding: '4px 0',
          }}
        >
          {expanded ? '▲ Ver menos' : '▼ Ver más detalle'}
        </button>
      </div>
    </div>
  )
}

export default function DiarioMedico() {
  const { user }                     = useAuth()
  const { ownerId, memberRole, profile } = useFamily()
  const { trialExpired }             = useSubscription()
  const [entries, setEntries]        = useState([])
  const [loading, setLoading]        = useState(true)
  const [showModal, setShowModal]    = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const channelRef                   = useRef(null)

  // Admin or cuidador can add entries
  const canAdd = memberRole === null || memberRole === 'cuidador'
  function openEntry() {
    if (trialExpired && memberRole === null) { setShowPaywall(true); return }
    setShowModal(true)
  }

  useEffect(() => {
    if (!ownerId) return
    load()
    subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [ownerId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('medical_diary')
      .select('*')
      .eq('owner_id', ownerId)
      .order('entry_date', { ascending: false })
      .order('entry_time', { ascending: false, nullsFirst: false })
      .limit(50)
    setEntries(data ?? [])
    setLoading(false)
  }

  function subscribe() {
    channelRef.current?.unsubscribe()
    channelRef.current = supabase
      .channel(`medical-diary:${ownerId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'medical_diary', filter: `owner_id=eq.${ownerId}`,
      }, payload => setEntries(prev => [payload.new, ...prev]))
      .subscribe()
  }

  // Group entries by month
  function monthLabel(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase())
  }

  const grouped = entries.reduce((acc, e) => {
    const key = monthLabel(e.entry_date)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #2D4A1E, #1A3A12)',
          borderRadius: 20, padding: '20px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📓</span>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white', fontFamily: 'Georgia, serif' }}>
                Notas Médicas IA
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                Habla o toma una foto y Milo organiza todo.
              </p>
            </div>
          </div>
          {canAdd && (
            <button
              onClick={openEntry}
              style={{
                padding: '10px 16px', borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: 'white',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              + Agregar
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 14, padding: '32px 0' }}>
            Cargando entradas...
          </p>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 48, margin: '0 0 12px' }}>📓</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
              Sin entradas aún
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 20px' }}>
              {canAdd
                ? 'Agrega la primera entrada con voz o foto de una receta, historia clínica o indicaciones.'
                : 'El administrador o cuidador puede agregar entradas del diario médico.'}
            </p>
            {canAdd && (
              <button
                onClick={openEntry}
                style={{
                  padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: '#4A7C59', color: 'white', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(74,124,89,0.3)',
                }}
              >
                Agregar primera entrada →
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.entries(grouped).map(([month, monthEntries]) => (
              <div key={month}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  margin: '0 0 10px 4px',
                }}>
                  {month} · {monthEntries.length} entrada{monthEntries.length !== 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {monthEntries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Read-only notice for familiares */}
        {!canAdd && entries.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20 }}>
            Solo el administrador y cuidadores pueden agregar entradas.
          </p>
        )}
      </div>

      <DiarioMedicoEntryModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          patientName={profile?.name?.split(' ')[0]}
        />
      )}
    </Layout>
  )
}
