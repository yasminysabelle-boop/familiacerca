import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  BookOpen, ClipboardCheck,
  Image, Mic,
  BarChart, User,
  Shield, Star,
  ChevronRight,
} from '../components/Icons'

const MORE_SECTIONS = [
  {
    label: 'Gestión del cuidado',
    items: [
      { to: '/diario-medico', Icon: BookOpen,       label: 'Notas Médicas IA',   desc: 'Historia clínica con IA — voz y foto',         color: '#2D4A1E' },
      { to: '/registros',    Icon: ClipboardCheck, label: 'Registro diario',    desc: 'Ánimo, comida, sueño, hidratación y evacuación', color: '#4A7C59' },
    ],
  },
  {
    label: 'Memorias y reportes',
    items: [
      { to: '/album',    Icon: Image,    label: 'Álbum familiar', desc: 'Fotos y videos de momentos especiales', color: '#C9882A' },
      { to: '/memorias', Icon: Mic,      label: 'Memorias',       desc: 'Diario de voz familiar',                color: '#7C5CBF' },
      { to: '/reportes', Icon: BarChart, label: 'Reportes',       desc: 'Análisis semanal y PDF médico',         color: '#2D86A0' },
    ],
  },
  {
    label: 'Suscripción',
    items: [
      { to: '/permisos', Icon: Shield, label: 'Permisos', desc: 'Control de acceso familiar',  color: '#6B7280' },
      { to: '/pricing',  Icon: Star,   label: 'Planes',   desc: 'Actualizar suscripción',       color: '#C9882A' },
    ],
  },
]

const PLAN_COLORS = { free: '#9CA3AF', familiar: '#4A7C59', care_plus: '#7C3AED' }
const PLAN_LABELS = { free: 'Prueba gratuita', familiar: 'Plan Familiar', care_plus: 'Cuidado Total' }

export default function More() {
  const { user } = useAuth()
  const { profile, ownerId, memberRole } = useFamily()
  const canEdit = memberRole === null || memberRole === 'cuidador'
  const { sub, isTrialing, daysLeft, trialExpired } = useSubscription()
  const navigate = useNavigate()
  const caretakerName = user?.user_metadata?.full_name ?? user?.email ?? ''
  const planColor = PLAN_COLORS[sub?.plan] ?? '#9CA3AF'
  const planLabel = PLAN_LABELS[sub?.plan] ?? 'Cargando...'

  const [patientProfile, setPatientProfile] = useState(null)

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('patient_profiles')
      .select('nombre_completo, diagnostico_principal, alergias, condiciones_secundarias, medico_tratante, especialidad_medico')
      .eq('owner_id', ownerId)
      .maybeSingle()
      .then(({ data }) => setPatientProfile(data ?? null))
  }, [ownerId])

  return (
    <Layout>
      <div className="p-5 pb-8">

        {/* Profile hero card */}
        <div
          className="rounded-3xl overflow-hidden mb-5"
          style={{ background: 'linear-gradient(145deg, #4A7C59 0%, #2E5240 100%)' }}
        >
          <div className="p-6 flex items-center gap-4">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.name}
                className="object-cover flex-shrink-0"
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2.5px solid rgba(201,136,42,0.5)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.12)',
                }}
              >
                <User size={28} color="rgba(255,255,255,0.55)" strokeWidth={1.2} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {profile ? (
                <>
                  <p
                    className="font-bold text-white leading-tight truncate"
                    style={{ fontFamily: 'Georgia, serif', fontSize: 20 }}
                  >
                    {patientProfile?.nombre_completo || profile.name}
                  </p>
                  {profile.age && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
                      {profile.age} años
                    </p>
                  )}
                  {patientProfile?.diagnostico_principal && (
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3, lineHeight: 1.4 }} className="truncate">
                      {patientProfile.diagnostico_principal}
                    </p>
                  )}
                  {patientProfile?.alergias?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: '#FCA5A5', fontWeight: 700 }}>⚠</span>
                      {patientProfile.alergias.slice(0, 3).map(a => (
                        <span key={a} style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                          background: 'rgba(220,38,38,0.25)', color: '#FCA5A5',
                          border: '1px solid rgba(220,38,38,0.3)',
                        }}>{a}</span>
                      ))}
                      {patientProfile.alergias.length > 3 && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>+{patientProfile.alergias.length - 3}</span>
                      )}
                    </div>
                  )}
                  {!patientProfile?.nombre_completo && canEdit && (
                    <Link to="/paciente/perfil" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, display: 'block', marginTop: 4, textDecoration: 'underline' }}>
                      + Completar perfil del paciente
                    </Link>
                  )}
                </>
              ) : null}
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4, letterSpacing: '0.03em' }}>
                Cuidado por {caretakerName}
              </p>
              {sub && (
                <div
                  onClick={() => navigate('/ajustes')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    marginTop: 8, padding: '4px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                    {planLabel}
                  </span>
                  {isTrialing && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                      · {daysLeft}d restantes
                    </span>
                  )}
                  {trialExpired && (
                    <span style={{ fontSize: 10, color: '#FCA5A5' }}>· Expirado</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature sections */}
        <div className="space-y-6 mb-5">
          {MORE_SECTIONS.map(({ label: sectionLabel, items }) => (
            <div key={sectionLabel}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '0 0 8px 4px',
              }}>
                {sectionLabel}
              </p>
              <div className="space-y-2">
                {items.map(({ to, Icon: IconComp, label, desc, color }) => (
                  <Link
                    key={to + label}
                    to={to}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white active:scale-[0.98] transition-transform"
                    style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 44, height: 44, borderRadius: 13, background: `${color}12` }}
                    >
                      <IconComp size={20} color={color} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <ChevronRight size={16} color="#CCCCCC" strokeWidth={2} />
                  </Link>
                ))}

              </div>
            </div>
          ))}
        </div>
      </div>

    </Layout>
  )
}
