import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, MoreVertical, Plus, Trash, XIcon } from '../components/Icons'
import { getLocation, mapsUrl } from '../lib/gps'
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

async function stampProof(file, confirmerName) {
  return new Promise(resolve => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const barH = Math.max(44, Math.round(img.naturalHeight * 0.07))
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, img.naturalHeight - barH, img.naturalWidth, barH)
      const now = new Date()
      const stamp = `${now.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })} · ${now.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })} · ${confirmerName} · FamiliaCerca ✓`
      const fs = Math.max(11, Math.round(img.naturalWidth * 0.022))
      ctx.fillStyle = 'white'
      ctx.font = `bold ${fs}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stamp, img.naturalWidth / 2, img.naturalHeight - barH / 2, img.naturalWidth - 16)
      URL.revokeObjectURL(objUrl)
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.92)
    }
    img.src = objUrl
  })
}

export default function Hoy() {
  const { user } = useAuth()
  const { ownerId, profile } = useFamily()
  const [medications, setMedications] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [menuOpen, setMenuOpen] = useState(null)       // med.id with open ⋮ menu
  const [confirmDialog, setConfirmDialog] = useState(null) // { onConfirm }

  const isAdmin = user?.id === ownerId

  // Bottom sheet for proof photo — shown immediately after marking
  const [proofSheet, setProofSheet] = useState(null) // { med } or null
  const [proofUploading, setProofUploading] = useState(false)
  const [proofStamping, setProofStamping] = useState(false)
  const [proofPreview, setProofPreview] = useState(null)
  const [proofBlob, setProofBlob] = useState(null)
  const [proofGps, setProofGps] = useState(null)
  const fileRef = useRef(null)

  // Tick every 30 s so countdown displays stay current
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  async function fetchData() {
    setLoading(true)
    setLoadError('')
    try {
      const [{ data: meds, error: e1 }, { data: todayLogs, error: e2 }] = await Promise.all([
        supabase.from('medications').select('*').eq('user_id', ownerId),
        supabase.from('medication_logs').select('*').eq('user_id', ownerId).eq('log_date', today),
      ])
      if (e1 || e2) throw e1 ?? e2
      setMedications(meds ?? [])
      const map = {}
      ;(todayLogs ?? []).forEach(l => { map[l.medication_id] = l })
      setLogs(map)
    } catch {
      setLoadError('No se pudieron cargar los medicamentos. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmMed(med) {
    setConfirming(med.id)
    // force: true — request GPS unconditionally regardless of the toggle setting
    const loc = await getLocation({ force: true })
    const confirmedAt = new Date().toISOString()
    await supabase.from('medication_logs').upsert({
      medication_id: med.id,
      user_id: ownerId,
      status: 'confirmed',
      log_date: today,
      confirmed_by_name: displayName,
      confirmed_at: confirmedAt,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      address: loc?.address ?? null,
    }, { onConflict: 'medication_id,log_date,user_id' })
    track('medication_marked_given', { medication_name: med.name, has_location: !!loc })
    setLogs(prev => ({
      ...prev,
      [med.id]: {
        status: 'confirmed',
        confirmed_by_name: displayName,
        confirmed_at: confirmedAt,
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        address: loc?.address ?? null,
        photo_url: null,
      },
    }))
    setConfirming(null)
    // Open the proof photo bottom sheet immediately
    openProofSheet(med)
  }

  async function unconfirmMed(med) {
    await supabase.from('medication_logs').delete()
      .eq('medication_id', med.id)
      .eq('user_id', ownerId)
      .eq('log_date', today)
    setLogs(prev => { const n = { ...prev }; delete n[med.id]; return n })
  }

  async function handleDeleteMed(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
    setLogs(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function openProofSheet(med) {
    setProofSheet({ med })
    setProofPreview(null)
    setProofBlob(null)
    setProofGps(null)
    setProofStamping(false)
  }

  function closeProofSheet() {
    setProofSheet(null)
    setProofPreview(null)
    setProofBlob(null)
    setProofGps(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleProofFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProofStamping(true)
    // Capture GPS and stamp the image in parallel
    const [stamped, loc] = await Promise.all([
      stampProof(f, displayName),
      getLocation({ force: true }),
    ])
    setProofBlob(stamped)
    setProofPreview(URL.createObjectURL(stamped))
    setProofGps(loc)
    setProofStamping(false)
  }

  async function submitProofPhoto() {
    if (!proofBlob || !proofSheet) return
    setProofUploading(true)
    try {
      const medId = proofSheet.med.id
      const path = `${ownerId}/${today}/${medId}.jpg`
      await supabase.storage.from('confirmations').upload(path, proofBlob, { upsert: true, contentType: 'image/jpeg' })
      const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
      // Save photo + GPS captured at photo time
      const updateFields = {
        photo_url: publicUrl,
        ...(proofGps && {
          latitude:  proofGps.latitude,
          longitude: proofGps.longitude,
          address:   proofGps.address,
        }),
      }
      await supabase.from('medication_logs')
        .update(updateFields)
        .eq('medication_id', medId)
        .eq('user_id', ownerId)
        .eq('log_date', today)
      setLogs(prev => ({ ...prev, [medId]: { ...prev[medId], ...updateFields } }))
      closeProofSheet()
    } catch { /* upload failed — sheet stays open */ }
    setProofUploading(false)
  }

  function firstTime(med) {
    if (med.scheduled_times?.length) return [...med.scheduled_times].sort()[0]
    return med.time ?? null
  }

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

  // Meds confirmed without photo within the last 30 min (from DB or current session)
  const pendingProof = medications.filter(med => {
    const log = logs[med.id]
    if (log?.status !== 'confirmed') return false
    if (log?.photo_url) return false
    if (!log?.confirmed_at) return false
    return (Date.now() - new Date(log.confirmed_at).getTime()) < 30 * 60 * 1000
  })

  return (
    <Layout>
      {/* Hidden file input for proof photos */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleProofFile}
      />

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
            background: allDone ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'white',
            borderRadius: 20, padding: '16px 18px',
            border: `1px solid ${allDone ? '#BBF7D0' : '#EDE5D8'}`,
            marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                {allDone ? '¡Todo dado hoy! ✅' : `${confirmedCount} de ${total} medicamentos`}
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? '#16A34A' : '#C4623A' }}>
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

        {/* Persistent proof reminders (meds confirmed > 0 min ago without photo, sheet dismissed) */}
        {pendingProof.filter(med => med.id !== proofSheet?.med?.id).map(med => {
          const log = logs[med.id]
          const minLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(log.confirmed_at).getTime()) / 60000))
          return (
            <div
              key={med.id}
              onClick={() => openProofSheet(med)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#FFFBEB', border: '1.5px solid #F59E0B',
                borderRadius: 14, padding: '10px 14px', marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>📷</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>
                  Agrega foto de prueba — {minLeft} min restantes
                </p>
                <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>{med.name}</p>
              </div>
              <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>📷 Agregar</span>
            </div>
          )
        })}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : loadError ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#D63031', marginBottom: 12 }}>{loadError}</p>
            <button onClick={fetchData} style={{ padding: '10px 24px', borderRadius: 12, background: '#C4623A', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Reintentar
            </button>
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

                    const hasPhoto = !!log?.photo_url
                    const hasGPS   = !!(log?.latitude && log?.longitude)
                    const proofExpired = isConfirmed && !hasPhoto && log?.confirmed_at &&
                      (Date.now() - new Date(log.confirmed_at).getTime()) >= 30 * 60 * 1000

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

                        {/* Status badges */}
                        {isConfirmed && (
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            {hasPhoto ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#16A34A',
                                background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                                display: 'block',
                              }}>
                                ✅ Con prueba
                              </span>
                            ) : proofExpired ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#92400E',
                                background: '#FFFBEB', padding: '3px 8px', borderRadius: 6,
                                display: 'block',
                              }}>
                                Sin foto de prueba
                              </span>
                            ) : (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#16A34A',
                                background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                                display: 'block',
                              }}>
                                ✓ Dado
                              </span>
                            )}

                            {hasGPS ? (
                              <a
                                href={mapsUrl(log.latitude, log.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: 10, color: '#2D86A0', textDecoration: 'none', display: 'block', marginTop: 3 }}
                              >
                                📍 Ver mapa
                              </a>
                            ) : log?.confirmed_by_name && (
                              <span style={{ fontSize: 9, color: '#9CA3AF', display: 'block', marginTop: 2 }}>
                                {log.confirmed_by_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )}

                        {/* ⋮ menu — admin only */}
                        {isAdmin && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === med.id ? null : med.id) }}
                              style={{
                                width: 28, height: 28, borderRadius: 8,
                                border: '1px solid #EDE5D8', background: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              aria-label="Opciones"
                            >
                              <MoreVertical size={14} color="#9CA3AF" strokeWidth={2} />
                            </button>

                            {menuOpen === med.id && (
                              <>
                                {/* Backdrop to close menu */}
                                <div
                                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                  onClick={() => setMenuOpen(null)}
                                />
                                <div style={{
                                  position: 'absolute', right: 0, top: 32, zIndex: 100,
                                  background: 'white', borderRadius: 12,
                                  border: '1px solid #EDE5D8',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                  minWidth: 180, overflow: 'hidden',
                                }}>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      setMenuOpen(null)
                                      setConfirmDialog({ onConfirm: () => handleDeleteMed(med.id) })
                                    }}
                                    style={{
                                      width: '100%', padding: '12px 16px',
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: '#D63031', fontSize: 13, fontWeight: 600,
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Trash size={14} color="#D63031" strokeWidth={1.75} />
                                    Eliminar medicamento
                                  </button>
                                </div>
                              </>
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

      {/* Delete confirmation dialog */}
      {confirmDialog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              ¿Eliminar este medicamento?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof photo bottom sheet — opens immediately after marking */}
      {proofSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeProofSheet() }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  📷 Foto de prueba
                </p>
                {(() => {
                  const confirmedAt = logs[proofSheet.med.id]?.confirmed_at
                  const minLeft = confirmedAt
                    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 60_000))
                    : 30
                  return (
                    <p style={{ fontSize: 13, color: minLeft <= 5 ? '#D97706' : '#6B7280', marginTop: 4 }}>
                      {proofSheet.med.name} — {minLeft > 0 ? `${minLeft} min restantes` : 'Tiempo agotado'}
                    </p>
                  )
                })()}
              </div>
              <button
                onClick={closeProofSheet}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            {/* Camera area */}
            <button
              type="button"
              onClick={() => !proofStamping && !proofUploading && fileRef.current?.click()}
              disabled={proofStamping || proofUploading}
              style={{
                width: '100%', border: '2px dashed #EDE5D8',
                borderRadius: 16, background: proofPreview ? 'transparent' : '#FDFAF7',
                cursor: proofStamping || proofUploading ? 'default' : 'pointer',
                overflow: 'hidden', marginBottom: 16,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {proofStamping ? (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Aplicando sello...</p>
                </div>
              ) : proofPreview ? (
                <>
                  <img src={proofPreview} alt="Prueba sellada" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                  <div style={{
                    width: '100%', padding: '10px 14px',
                    background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ fontSize: 14 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', margin: 0 }}>Sello aplicado · Toca para cambiar</p>
                      {proofGps && (
                        <p style={{ fontSize: 11, color: '#4A7C59', margin: '2px 0 0' }}>
                          📍 {proofGps.address ?? `${proofGps.latitude.toFixed(5)}, ${proofGps.longitude.toFixed(5)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: '#FDF0EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 30 }}>📷</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                    Tomar foto de prueba
                  </p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                    Se sellará automáticamente con fecha y hora
                  </p>
                </div>
              )}
            </button>

            {/* Action buttons */}
            <button
              onClick={submitProofPhoto}
              disabled={!proofBlob || proofUploading || proofStamping}
              style={{
                width: '100%', padding: '14px', marginBottom: 10,
                borderRadius: 14, border: 'none',
                background: proofBlob && !proofUploading
                  ? 'linear-gradient(135deg, #C4623A, #A85130)'
                  : '#D4C4B8',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: proofBlob && !proofUploading ? 'pointer' : 'not-allowed',
                boxShadow: proofBlob ? '0 6px 20px rgba(196,98,58,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {proofUploading ? 'Guardando...' : '✓ Guardar foto de prueba'}
            </button>

            <button
              onClick={closeProofSheet}
              style={{
                width: '100%', padding: '12px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#9CA3AF',
              }}
            >
              Omitir por ahora (tienes 30 min)
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
