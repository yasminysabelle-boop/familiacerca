import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import EmergencyAlert from '../components/EmergencyAlert'
import {
  Pill, Calendar, FileText, ClipboardCheck, Image, Mic,
  AlertTriangle, Heart, User, Clock, Gift, Info, CheckIcon,
} from '../components/Icons'

const CONCERN_KEYWORDS = ['dolor', 'caída', 'fiebre', 'triste', 'deprimido', 'sin apetito', 'no comió', 'confundido', 'peor', 'mal']

function getDynamicGreeting(adherence, missed7, profileName) {
  const h = new Date().getHours()
  const base = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const icon = h < 12 ? '☀️' : h < 19 ? '🌤️' : '🌙'

  let message
  if (adherence === null) {
    // No medication data yet — new user welcome state
    message = profileName ? `Cuidando a ${profileName} 🌱` : 'Bienvenido a FamiliaCerca 🌱'
  } else if (adherence >= 80) {
    // Great week — rotate emotionally warm messages by day of week
    const opts = profileName
      ? [`${profileName} está en excelentes manos 💚`, `Semana perfecta con ${profileName} ✨`, `${profileName} está bien cuidado esta semana 🌟`]
      : ['¡Excelente semana de cuidado! 💚', 'Todo en orden esta semana ✨', 'Cuidado excepcional esta semana 🌟']
    message = opts[new Date().getDay() % opts.length]
  } else if (adherence >= 50) {
    // Moderate — gentle, non-alarming nudge
    message = missed7 > 0
      ? `${missed7} dosis sin confirmar esta semana ⚠️`
      : (profileName ? `Sigue con el cuidado de ${profileName} 💪` : 'Sigue adelante 💪')
  } else {
    // Low adherence — caring, not scolding
    message = profileName
      ? `${profileName} necesita más atención esta semana 🙏`
      : 'Los medicamentos necesitan atención hoy 🙏'
  }

  return { icon, base, message }
}

function StatCard({ Icon: IconComp, label, value, to, accentColor }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl p-5 flex flex-col gap-4 active:scale-[0.96] transition-transform"
      style={{ boxShadow: '0 3px 20px rgba(0,0,0,0.07)', borderTop: `3px solid ${accentColor}` }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${accentColor}15` }}>
        <IconComp size={20} color={accentColor} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1.5">{label}</p>
      </div>
    </Link>
  )
}

const QUICK_LINKS = [
  { to: '/historial',  Icon: ClipboardCheck, label: 'Control\nde dosis', color: '#C4623A' },
  { to: '/calendar',   Icon: Calendar,       label: 'Calendario',        color: '#4A7C59' },
  { to: '/album',      Icon: Image,          label: 'Álbum\nfamiliar',   color: '#D4A853' },
  { to: '/diario-voz', Icon: Mic,            label: 'Diario\nde voz',    color: '#7C5CBF' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { profile } = useFamily()
  const [stats, setStats] = useState({ medications: 0, events: 0, notes: 0 })
  const [recentNotes, setRecentNotes] = useState([])
  const [logs7, setLogs7] = useState([])
  const [day10Dismissed, setDay10Dismissed] = useState(
    () => !!localStorage.getItem('fc_day10_dismissed')
  )

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Bienvenido'

  // Trial calculations
  const trialDaysElapsed = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
    : 0
  const trialDaysLeft = Math.max(0, 14 - trialDaysElapsed)
  const isInTrial = trialDaysElapsed < 14
  const showDay10 = trialDaysElapsed >= 10 && trialDaysElapsed < 14 && !day10Dismissed

  useEffect(() => {
    if (!user) return
    const since = new Date(); since.setDate(since.getDate() - 7)
    Promise.all([
      supabase.from('medications').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('notes').select('id, title, content, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('medication_logs').select('status').eq('user_id', user.id).gte('log_date', since.toISOString().split('T')[0]),
    ]).then(([{ count: meds }, { count: events }, { count: notes }, { data: latest }, { data: logs }]) => {
      setStats({ medications: meds ?? 0, events: events ?? 0, notes: notes ?? 0 })
      setRecentNotes(latest ?? [])
      setLogs7(logs ?? [])
    })
  }, [user])

  const confirmed7 = logs7.filter(l => l.status === 'confirmed').length
  const missed7    = logs7.filter(l => l.status === 'missed').length
  const adherence  = logs7.length ? Math.round((confirmed7 / logs7.length) * 100) : null
  const greeting   = getDynamicGreeting(adherence, missed7, profile?.name)
  const concerns   = recentNotes.filter(n =>
    CONCERN_KEYWORDS.some(kw => (n.title + ' ' + (n.content ?? '')).toLowerCase().includes(kw))
  )

  // Onboarding progress
  const onboardingSteps = [
    { label: 'Familiar agregado',       done: !!profile?.name,       to: '/perfil' },
    { label: 'Foto del familiar',        done: !!profile?.photo_url,  to: '/perfil' },
    { label: 'Primer medicamento',       done: stats.medications > 0, to: '/medications' },
    { label: 'Primera cita registrada',  done: stats.events > 0,      to: '/calendar' },
  ]
  const stepsDone = onboardingSteps.filter(s => s.done).length
  const showOnboarding = stepsDone < onboardingSteps.length

  function dismissDay10() {
    localStorage.setItem('fc_day10_dismissed', 'true')
    setDay10Dismissed(true)
  }

  return (
    <Layout>
      <div className="p-5 pb-8 max-w-2xl">

        {/* ── Premium membership hero card ── */}
        <div className="rounded-3xl overflow-hidden mb-5 relative"
          style={{ background: 'linear-gradient(145deg, #BF5E37 0%, #8C3E22 55%, #6B2E18 100%)' }}>
          {/* Light orb top-right */}
          <div className="absolute pointer-events-none"
            style={{ width: 220, height: 220, top: -60, right: -60, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.13) 0%, transparent 65%)' }} />
          {/* Faint orb bottom-left */}
          <div className="absolute pointer-events-none"
            style={{ width: 140, height: 140, bottom: -50, left: -30, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />

          <div className="relative p-6">
            {/* Card header: brand mark + plan tier */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9,
                  letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>
                  FamiliaCerca
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9,
                letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase' }}>
                Plan Familiar
              </span>
            </div>

            {/* Main content row */}
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="overflow-hidden"
                  style={{ width: 56, height: 56, borderRadius: '50%',
                    border: '2.5px solid rgba(212,168,83,0.55)',
                    background: 'rgba(255,255,255,0.12)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
                  {profile?.photo_url ? (
                    <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                        letterSpacing: '0.02em', lineHeight: 1, userSelect: 'none' }}>
                      {profile?.name
                        ? profile.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
                        : '?'}
                    </div>
                  )}
                </div>
                {/* Heart badge */}
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center animate-heartbeat"
                  style={{ width: 22, height: 22, borderRadius: '50%', background: 'white',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                  <Heart size={11} color="#C4623A" strokeWidth={1.5} filled />
                </div>
              </div>

              {/* Greeting */}
              <div className="min-w-0 flex-1">
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.03em', marginBottom: 3 }}>
                  {greeting.icon} {greeting.base}
                </p>
                <p className="text-white font-bold leading-tight truncate"
                  style={{ fontFamily: 'Georgia, serif', fontSize: 26, letterSpacing: '-0.5px' }}>
                  {firstName}
                </p>
                {profile ? (
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
                    {greeting.message}
                  </p>
                ) : (
                  <Link to="/onboarding"
                    style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 6,
                      display: 'block', textDecoration: 'underline' }}>
                    + Agregar familiar
                  </Link>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex mt-6 pt-5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              {adherence !== null && (
                <>
                  <div className="text-center flex-1">
                    <p className="text-white font-bold leading-none" style={{ fontSize: 20 }}>{adherence}%</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, letterSpacing: '0.04em' }}>
                      Adherencia
                    </p>
                  </div>
                  <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.18)' }} />
                </>
              )}
              <div className="text-center flex-1">
                <p className="text-white font-bold leading-none" style={{ fontSize: 20 }}>{stats.medications}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, letterSpacing: '0.04em' }}>
                  Medicamentos
                </p>
              </div>
              <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.18)' }} />
              <div className="text-center flex-1">
                <p className="text-white font-bold leading-none" style={{ fontSize: 20 }}>{stats.events}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, letterSpacing: '0.04em' }}>
                  Eventos
                </p>
              </div>
              <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.18)' }} />
              <div className="text-center flex-1">
                <p className="text-white font-bold leading-none" style={{ fontSize: 20 }}>{stats.notes}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, letterSpacing: '0.04em' }}>
                  Notas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Day 10 trial conversion notification ── */}
        {showDay10 && (
          <div className="relative rounded-2xl p-5 mb-5 animate-float-in"
            style={{ background: 'linear-gradient(135deg, #FDF0EB, #FDF8EE)',
              border: '1px solid #F0C8B0', boxShadow: '0 4px 20px rgba(196,98,58,0.12)' }}>
            <button onClick={dismissDay10}
              className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#999' }}>
              ✕
            </button>
            <div className="flex items-start gap-3 pr-6">
              <Heart size={18} color="#C4623A" strokeWidth={1.5} filled />
              <div>
                <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                  No pierdas tu historial
                </p>
                <p className="text-xs text-gray-600 leading-relaxed mt-1">
                  Tu familia lleva <strong>{trialDaysElapsed} días</strong> coordinando el cuidado
                  {profile?.name ? ` de ${profile.name}` : ''}.
                  Te quedan <strong>{trialDaysLeft} días</strong> de prueba gratis.
                </p>
              </div>
            </div>
            <button
              className="mt-4 w-full py-2.5 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #C4623A, #A85130)',
                boxShadow: '0 4px 16px rgba(196,98,58,0.3)' }}>
              Activar plan por $19/mes →
            </button>
          </div>
        )}

        {/* ── Trial badge (days 1-9) ── */}
        {isInTrial && !showDay10 && (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-5"
            style={{ background: '#FDF8EE', border: '1px solid #E8D89A' }}>
            <Clock size={18} color="#A07830" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {trialDaysLeft > 1 ? `${trialDaysLeft} días gratis restantes` : 'Último día de prueba'}
              </p>
              <p className="text-xs text-gray-400">Sin tarjeta de crédito</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: '#D4A853' }}>
              FREE
            </span>
          </div>
        )}

        {/* ── Onboarding progress ── */}
        {showOnboarding && (
          <div className="bg-white rounded-2xl p-5 mb-5"
            style={{ boxShadow: '0 3px 20px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                Completa tu perfil
              </p>
              <span className="text-xs font-bold" style={{ color: '#C4623A' }}>
                {stepsDone}/{onboardingSteps.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full mb-5" style={{ background: '#F5EEE6' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(stepsDone / onboardingSteps.length) * 100}%`,
                  background: 'linear-gradient(90deg, #C4623A, #D4A853)' }} />
            </div>
            <div className="space-y-3.5">
              {onboardingSteps.map(step => (
                <Link key={step.label} to={step.done ? '#' : step.to}
                  className={`flex items-center gap-3 ${!step.done ? 'active:opacity-70' : ''}`}
                  onClick={step.done ? e => e.preventDefault() : undefined}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: step.done ? '#C4623A' : 'white',
                      border: step.done ? 'none' : '1.5px solid #EDE5D8',
                    }}>
                    {step.done && <CheckIcon size={11} color="white" strokeWidth={2.5} />}
                  </div>
                  <p className={`text-sm flex-1 ${step.done ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <span style={{ color: '#C4623A', fontSize: 18, lineHeight: 1 }}>›</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Profile nudge */}
        {!profile && (
          <div className="rounded-2xl p-5 mb-5 flex items-center gap-4"
            style={{ background: '#FDF8EE', border: '1px solid #E8D89A' }}>
            <Info size={22} color="#A07830" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Configura el perfil del familiar</p>
              <Link to="/onboarding" className="text-xs font-semibold underline mt-0.5 block" style={{ color: '#C4623A' }}>
                Agregar ahora →
              </Link>
            </div>
          </div>
        )}

        {/* Emergency button */}
        <EmergencyAlert />

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard Icon={Pill}     label="Medicamentos" value={stats.medications} to="/medications" accentColor="#C4623A" />
          <StatCard Icon={Calendar} label="Eventos"      value={stats.events}      to="/calendar"    accentColor="#4A7C59" />
          <StatCard Icon={FileText} label="Notas"        value={stats.notes}       to="/notes"       accentColor="#D4A853" />
        </div>

        {/* ── Wellness summary ── */}
        {(logs7.length > 0 || concerns.length > 0) && (
          <div className="bg-white rounded-2xl p-5 mb-5"
            style={{ boxShadow: '0 3px 20px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                Bienestar esta semana
              </p>
              <Link to="/reportes" className="text-xs font-medium" style={{ color: '#C4623A' }}>
                Ver análisis →
              </Link>
            </div>
            <div className="space-y-2.5">
              {logs7.length > 0 && (
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                  style={{
                    background: adherence >= 80 ? '#F0FAF2' : adherence >= 50 ? '#FFF8EE' : '#FFF0F0',
                    border: `1px solid ${adherence >= 80 ? '#C0E4C8' : adherence >= 50 ? '#F0D998' : '#FFBABA'}`,
                  }}>
                  <AlertTriangle
                    size={16}
                    color={adherence >= 80 ? '#4A7C59' : adherence >= 50 ? '#A07830' : '#D63031'}
                    strokeWidth={1.5}
                  />
                  <p className="text-xs text-gray-700">
                    <strong>{adherence}% adherencia</strong> — {confirmed7} confirmadas, {missed7} perdidas
                    {missed7 >= 3 && <span className="font-semibold" style={{ color: '#D63031' }}> · Consultar médico</span>}
                  </p>
                </div>
              )}
              {concerns.length > 0 && (
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                  style={{ background: '#FFF8EE', border: '1px solid #F0D998' }}>
                  <AlertTriangle size={16} color="#A07830" strokeWidth={1.5} />
                  <p className="text-xs text-gray-700">
                    <strong>{concerns.length} nota{concerns.length > 1 ? 's' : ''}</strong> con términos de atención —{' '}
                    <Link to="/reportes" className="underline font-medium" style={{ color: '#C4623A' }}>ver análisis</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom grid ── */}
        <div className="grid grid-cols-1 gap-5">
          {/* Recent notes */}
          <div className="bg-white rounded-2xl p-5"
            style={{ boxShadow: '0 3px 20px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                Notas recientes
              </p>
              <Link to="/notes" className="text-xs font-medium" style={{ color: '#C4623A' }}>Ver todas</Link>
            </div>
            {recentNotes.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No hay notas.{' '}
                <Link to="/notes" className="underline" style={{ color: '#C4623A' }}>Crea la primera</Link>
              </p>
            ) : (
              <ul>
                {recentNotes.map((note, i) => (
                  <li key={note.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: i < recentNotes.length - 1 ? '1px solid #F5EEE6' : 'none' }}>
                    <span className="text-sm text-gray-700 truncate mr-4">{note.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(note.created_at).toLocaleDateString('es-US')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick access */}
          <div className="bg-white rounded-2xl p-5"
            style={{ boxShadow: '0 3px 20px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}>
            <p className="font-bold text-gray-900 text-sm mb-4" style={{ fontFamily: 'Georgia, serif' }}>
              Accesos rápidos
            </p>
            <div className="grid grid-cols-4 gap-3">
              {QUICK_LINKS.map(({ to, Icon: IconComp, label, color }) => (
                <Link key={to} to={to}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-[0.93] transition-transform"
                  style={{ background: `${color}0D` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: `${color}18` }}>
                    <IconComp size={22} color={color} strokeWidth={1.5} />
                  </div>
                  <span className="text-[9px] font-bold text-center leading-tight whitespace-pre-line"
                    style={{ color }}>
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
