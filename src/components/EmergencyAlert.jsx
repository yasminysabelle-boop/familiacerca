import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckIcon, XIcon } from './Icons'

export default function EmergencyAlert() {
  const { user } = useAuth()
  const { profile } = useFamily()
  const [confirming, setConfirming] = useState(false)
  const [sent, setSent] = useState(false)
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
    await supabase.from('emergency_alerts').insert({
      user_id: user.id,
      triggered_by_name: displayName,
      relative_name: profile?.name ?? null,
    })
    setSent(true)
    setTimeout(() => setSent(false), 15000)
  }

  async function resolveAlert() {
    if (!activeAlert) return
    await supabase.from('emergency_alerts').update({ resolved: true }).eq('id', activeAlert.id)
    setActiveAlert(null)
  }

  return (
    <>
      {/* Active alert banner — covers header intentionally */}
      {activeAlert && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 animate-pulse"
          style={{ background: 'linear-gradient(90deg, #D63031, #E84444)', boxShadow: '0 4px 20px rgba(214,48,49,0.5)' }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} color="white" strokeWidth={2} />
            <div>
              <p className="font-bold text-white text-sm leading-tight">ALERTA DE EMERGENCIA ACTIVA</p>
              <p className="text-white/80 text-xs mt-0.5">
                Activada por {activeAlert.triggered_by_name}
                {activeAlert.relative_name && ` · ${activeAlert.relative_name}`}
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
          background: sent ? '#FDECEA' : 'white',
          border: sent ? '1px solid #FFBABA' : '1px solid #EDE5D8',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-gray-900 text-sm leading-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Botón de emergencia
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">
              {profile?.name
                ? `Alerta inmediata a la familia sobre ${profile.name}`
                : 'Notifica a toda la familia al instante'}
            </p>
            {sent && (
              <p className="text-xs font-semibold mt-2 flex items-center gap-1.5" style={{ color: '#D63031' }}>
                <AlertTriangle size={12} color="#D63031" strokeWidth={2} />
                Toda la familia ha sido notificada
              </p>
            )}
          </div>

          {/* SOS button */}
          <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
            {!sent && (
              <span
                className="absolute inset-0 rounded-full animate-sos-pulse"
                style={{ background: 'rgba(214,48,49,0.22)' }}
              />
            )}
            <button
              onClick={() => setConfirming(true)}
              className="absolute inset-0 rounded-full text-white font-black flex items-center justify-center animate-sos-heartbeat active:scale-90"
              style={{
                background: 'linear-gradient(135deg, #D63031, #B82020)',
                fontSize: 13,
                letterSpacing: '0.05em',
              }}
            >
              SOS
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
            {/* Close */}
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
                Todos los miembros de la familia recibirán una alerta inmediata
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
                Sí, es una emergencia real
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
