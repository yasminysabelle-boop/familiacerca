import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import { getLocation, mapsUrl } from '../lib/gps'
import { AlertTriangle, CheckIcon, Phone, XIcon } from './Icons'

export default function EmergencyAlert() {
  const { user } = useAuth()
  const { profile, ownerId } = useFamily()
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [pushFailed, setPushFailed] = useState(false)
  const [fallbackContacts, setFallbackContacts] = useState([])
  const [activeAlert, setActiveAlert] = useState(null)
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    checkActiveAlerts()
    const channel = supabase
      .channel('emergency-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_alerts' }, payload => {
        if (!payload.new.resolved) setActiveAlert(payload.new)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_alerts' }, payload => {
        if (payload.new.resolved) setActiveAlert(prev => prev?.id === payload.new.id ? null : prev)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function checkActiveAlerts() {
    const { data } = await supabase
      .from('emergency_alerts').select('*').eq('resolved', false)
      .order('created_at', { ascending: false }).limit(1)
    if (data?.length) setActiveAlert(data[0])
  }

  async function handleEmergency() {
    setConfirming(false)
    setSending(true)

    if (!ownerId) {
      setPushFailed(true)
      setSending(false)
      setSent(true)
      setTimeout(() => { setSent(false); setPushFailed(false) }, 15000)
      return
    }

    // Capture GPS — always force on emergencies
    const loc = await getLocation({ force: true })

    // Insert into DB — triggers realtime banner for all family members
    const { error: insertError } = await supabase.from('emergency_alerts').insert({
      user_id: user.id,
      triggered_by_name: displayName,
      relative_name: profile?.name ?? null,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      address: loc?.address ?? null,
    })
    // Invoke edge function
    const payload = {
      ownerId,
      triggeredByName: displayName,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      address: loc?.address ?? null,
    }
    let pushOk = false
    try {
      const { data, error } = await supabase.functions.invoke('send-sos-notification', {
        body: payload,
      })
      if (!error && data?.sent > 0) {
        pushOk = true
      }
    } catch {
      // push failed — fall through to directory contact fallback
    }

    if (!pushOk) {
      const { data: contacts } = await supabase
        .from('directory_contacts')
        .select('name, phone, relationship')
        .eq('owner_id', ownerId)
        .not('phone', 'is', null)
        .order('is_emergency_contact', { ascending: false })
        .limit(5)
      setFallbackContacts(contacts ?? [])
      setPushFailed(true)
    }

    setSending(false)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setPushFailed(false)
      setFallbackContacts([])
    }, 30000)
  }

  async function resolveAlert() {
    if (!activeAlert) return
    await supabase.from('emergency_alerts').update({ resolved: true }).eq('id', activeAlert.id)
    setActiveAlert(null)
  }

  return (
    <>
      {/* Active alert banner — shown to all family members via realtime */}
      {activeAlert && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 animate-pulse"
          style={{ background: 'linear-gradient(90deg, #D63031, #E84444)', boxShadow: '0 4px 20px rgba(214,48,49,0.5)' }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} color="white" strokeWidth={2} />
            <div>
              <p className="font-bold text-white text-sm leading-tight">🚨 ALERTA DE EMERGENCIA ACTIVA</p>
              <p className="text-white/80 text-xs mt-0.5">
                {activeAlert.triggered_by_name}
                {activeAlert.relative_name && ` · ${activeAlert.relative_name}`}
                {activeAlert.address && ` · 📍 ${activeAlert.address}`}
              </p>
            </div>
          </div>
          <button
            onClick={resolveAlert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0 transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <CheckIcon size={13} color="white" strokeWidth={2.5} />
            Resolver
          </button>
        </div>
      )}

      {/* SOS card */}
      <div
        className="rounded-2xl p-5 mb-5 transition-all"
        style={{
          background: sent ? (pushFailed ? '#FFFBEB' : '#F0FDF4') : 'white',
          border: sent ? (pushFailed ? '1px solid #FCD34D' : '1px solid #86EFAC') : '1px solid #EDE5D8',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
              Botón de emergencia
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">
              {profile?.name
                ? `Alerta inmediata a la familia sobre ${profile.name}`
                : 'Notifica a toda la familia al instante'}
            </p>

            {sent && !pushFailed && (
              <p className="text-xs font-semibold mt-2 flex items-center gap-1.5" style={{ color: '#15803D' }}>
                <CheckIcon size={12} color="#15803D" strokeWidth={2.5} />
                ✅ Tu familia fue notificada
              </p>
            )}

            {sent && pushFailed && (
              <div style={{ marginTop: 8 }}>
                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#4A7C59' }}>
                  <AlertTriangle size={12} color="#4A7C59" strokeWidth={2} />
                  Sin señal push — llama directamente:
                </p>
                {fallbackContacts.length > 0 ? (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {fallbackContacts.map((c, i) => (
                      <a
                        key={i}
                        href={`tel:${c.phone}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 10,
                          background: '#EBF3EE', textDecoration: 'none',
                        }}
                      >
                        <Phone size={13} color="#4A7C59" strokeWidth={2} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                          {c.name} {c.relationship ? `(${c.relationship})` : ''} — {c.phone}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Agrega contactos en el Directorio para verlos aquí.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SOS button */}
          <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
            {!sent && !sending && (
              <span
                className="absolute inset-0 rounded-full animate-sos-pulse"
                style={{ background: 'rgba(214,48,49,0.22)' }}
              />
            )}
            <button
              onClick={() => !sending && !sent && setConfirming(true)}
              disabled={sending || sent}
              className="absolute inset-0 rounded-full text-white font-black flex items-center justify-center active:scale-90"
              style={{
                background: sent
                  ? (pushFailed ? '#4A7C59' : '#15803D')
                  : 'linear-gradient(135deg, #D63031, #B82020)',
                fontSize: sending ? 10 : 13,
                letterSpacing: '0.05em',
                transition: 'background 0.3s',
                animation: sending ? 'none' : undefined,
              }}
            >
              {sending ? 'Enviando...' : sent ? (pushFailed ? '⚠️' : '✓') : 'SOS'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-6 sm:pb-4">
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float-in"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setConfirming(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ background: '#F5EEE6', color: '#999' }}
              >
                <XIcon size={14} color="#999" strokeWidth={2} />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#FFF0F0', border: '2px solid #FFBABA' }}>
                <AlertTriangle size={28} color="#D63031" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                ¿Activar emergencia?
              </h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Todos los miembros de la familia recibirán una alerta inmediata con tu ubicación
                {profile?.name ? ` sobre ${profile.name}` : ''}.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleEmergency}
                className="w-full py-4 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #D63031, #B82020)',
                  boxShadow: '0 6px 20px rgba(214,48,49,0.35)',
                }}
              >
                🚨 Sí, es una emergencia real
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="w-full py-3.5 text-gray-600 font-semibold rounded-2xl text-sm transition-all active:scale-[0.97]"
                style={{ border: '1px solid #EDE5D8', background: 'white' }}
              >
                Cancelar — fue un error
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
