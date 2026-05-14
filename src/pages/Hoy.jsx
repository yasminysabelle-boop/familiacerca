import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, Plus } from '../components/Icons'
import { getLocation } from '../lib/gps'
import { track } from '../lib/analytics'

const TIME_GROUPS = [
  { id: 0, label: 'Mañana',      icon: '🌅', range: [0, 12] },
  { id: 1, label: 'Tarde',       icon: '☀️',  range: [12, 18] },
  { id: 2, label: 'Noche',       icon: '🌙', range: [18, 24] },
  { id: 3, label: 'Sin horario', icon: '💊', range: null },
]

function groupIndex(timeStr) {
  if (!timeStr) return 3
  const h = parseInt(timeStr.split(':')[0], 10)
  if (h < 12) return 0
  if (h < 18) return 1
  return 2
}

export default function Hoy() {
  const { user } = useAuth()
  const { ownerId, profile } = useFamily()
  const [medications, setMedications] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  async function fetchData() {
    setLoading(true)
    const [{ data: meds }, { data: todayLogs }] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', ownerId),
      supabase.from('medication_logs').select('*').eq('user_id', ownerId).eq('log_date', today),
    ])
    setMedications(meds ?? [])
    const map = {}
    ;(todayLogs ?? []).forEach(l => { map[l.medication_id] = l })
    setLogs(map)
    setLoading(false)
  }

  async function confirmMed(med) {
    setConfirming(med.id)
    const loc = await getLocation()
    await supabase.from('medication_logs').upsert({
      medication_id: med.id,
      user_id: ownerId,
      status: 'confirmed',
      log_date: today,
      confirmed_by_name: displayName,
      confirmed_at: new Date().toISOString(),
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      address: loc?.address ?? null,
    }, { onConflict: 'medication_id,log_date,user_id' })
    track('medication_marked_given', { medication_name: med.name, has_location: !!loc })
    setLogs(prev => ({ ...prev, [med.id]: { status: 'confirmed', confirmed_by_name: displayName } }))
    setConfirming(null)
  }

  async function unconfirmMed(med) {
    await supabase.from('medication_logs').delete()
      .eq('medication_id', med.id)
      .eq('user_id', ownerId)
      .eq('log_date', today)
    setLogs(prev => { const n = { ...prev }; delete n[med.id]; return n })
  }

  function firstTime(med) {
    if (med.scheduled_times?.length) return [...med.scheduled_times].sort()[0]
    return med.time ?? null
  }

  // Build grouped structure
  const grouped = {}
  for (const med of medications) {
    const t = firstTime(med)
    const g = groupIndex(t)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push({ ...med, _firstTime: t })
  }

  const confirmedCount = medications.filter(m => logs[m.id]?.status === 'confirmed').length
  const total = medications.length
  const allDone = total > 0 && confirmedCount === total

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Add medication button */}
        <Link
          to="/medications?add=1"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 0', borderRadius: 14, marginBottom: 14,
            background: 'linear-gradient(135deg, #C4623A, #A85130)',
            color: 'white', fontWeight: 700, fontSize: 14,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(196,98,58,0.3)',
          }}
        >
          <Plus size={16} color="white" strokeWidth={2.5} />
          Agregar medicamento
        </Link>

        {/* Progress card */}
        {total > 0 && (
          <div style={{
            background: allDone
              ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)'
              : 'white',
            borderRadius: 20, padding: '16px 18px',
            border: `1px solid ${allDone ? '#BBF7D0' : '#EDE5D8'}`,
            marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                {allDone ? '¡Todo dado hoy! ✅' : `${confirmedCount} de ${total} medicamentos`}
              </p>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: allDone ? '#16A34A' : '#C4623A',
              }}>
                {total > 0 ? Math.round((confirmedCount / total) * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: allDone ? '#BBF7D0' : '#F5EEE6' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${total ? (confirmedCount / total) * 100 : 0}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                  : 'linear-gradient(90deg, #C4623A, #D4A853)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            {allDone && (
              <p style={{ fontSize: 12, color: '#16A34A', fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
                {profile?.name ? `${profile.name} tomó todos sus medicamentos hoy 💙` : 'Todos los medicamentos dados hoy 💙'}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : medications.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '48px 24px', textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💊</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
              Sin medicamentos configurados
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
              Agrega los medicamentos del familiar para verlos aquí cada día.
            </p>
            <Link
              to="/medications?add=1"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #C4623A, #A85130)',
                color: 'white', fontWeight: 700, fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <Plus size={14} color="white" strokeWidth={2.5} />
              Agregar medicamento
            </Link>
          </div>
        ) : (
          TIME_GROUPS.map(group => {
            const meds = (grouped[group.id] ?? [])
              .sort((a, b) => (a._firstTime ?? '99:99').localeCompare(b._firstTime ?? '99:99'))
            if (!meds.length) return null
            return (
              <div key={group.id} style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#9CA3AF',
                  marginBottom: 8, paddingLeft: 2,
                }}>
                  {group.icon} {group.label}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {meds.map(med => {
                    const log = logs[med.id]
                    const isConfirmed = log?.status === 'confirmed'
                    const isWorking = confirming === med.id
                    const allTimes = med.scheduled_times?.length
                      ? [...med.scheduled_times].sort()
                      : med.time ? [med.time] : []

                    return (
                      <div
                        key={med.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: isConfirmed ? '#F0FDF4' : 'white',
                          borderRadius: 16,
                          border: `1px solid ${isConfirmed ? '#BBF7D0' : '#EDE5D8'}`,
                          padding: '12px 14px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          transition: 'all 0.25s',
                        }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => isConfirmed ? unconfirmMed(med) : confirmMed(med)}
                          disabled={isWorking}
                          style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            border: `2px solid ${isConfirmed ? '#22C55E' : '#D1D5DB'}`,
                            background: isConfirmed ? '#22C55E' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: isWorking ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                          aria-label={isConfirmed ? 'Desmarcar' : 'Marcar como dado'}
                        >
                          {isConfirmed && <CheckIcon size={14} color="white" strokeWidth={2.5} />}
                          {isWorking && !isConfirmed && (
                            <div style={{
                              width: 10, height: 10, borderRadius: '50%',
                              border: '2px solid #D1D5DB', borderTopColor: '#C4623A',
                              animation: 'spin 0.6s linear infinite',
                            }} />
                          )}
                        </button>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 14, fontWeight: 600, margin: 0,
                            color: isConfirmed ? '#9CA3AF' : '#1A1A1A',
                            textDecoration: isConfirmed ? 'line-through' : 'none',
                          }}>
                            {med.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                            {med.dosage && (
                              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{med.dosage}</span>
                            )}
                            {allTimes.map(t => (
                              <span key={t} style={{
                                fontSize: 11, color: '#9CA3AF',
                                background: '#F5EEE6', padding: '1px 6px', borderRadius: 4,
                              }}>
                                ⏰ {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Status badge */}
                        {isConfirmed && (
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: '#16A34A',
                              background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                              display: 'block',
                            }}>
                              ✓ Dado
                            </span>
                            {log?.confirmed_by_name && (
                              <span style={{ fontSize: 9, color: '#9CA3AF', display: 'block', marginTop: 2 }}>
                                {log.confirmed_by_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}
