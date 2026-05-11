import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Layout from '../components/Layout'
import {
  ClipboardCheck, FileText, Image, Mic, BarChart, User,
  LogOut, ChevronRight,
} from '../components/Icons'

const MORE_ITEMS = [
  { to: '/historial',  Icon: ClipboardCheck, label: 'Control de dosis',    desc: 'Historial y foto-pruebas selladas',    color: '#C4623A' },
  { to: '/notes',      Icon: FileText,        label: 'Notas',               desc: 'Observaciones del cuidado diario',    color: '#4A7C59' },
  { to: '/album',      Icon: Image,           label: 'Álbum familiar',      desc: 'Fotos y videos de momentos especiales', color: '#D4A853' },
  { to: '/diario-voz', Icon: Mic,             label: 'Diario de voz',       desc: 'Notas de voz del familiar',           color: '#7C5CBF' },
  { to: '/reportes',   Icon: BarChart,        label: 'Reportes',            desc: 'Análisis semanal y PDF médico',        color: '#2D86A0' },
  { to: '/perfil',     Icon: User,            label: 'Perfil familiar',     desc: 'Datos de la persona a cuidar',        color: '#C4623A' },
]

export default function More() {
  const { user, signOut } = useAuth()
  const { profile } = useFamily()
  const navigate = useNavigate()
  const caretakerName = user?.user_metadata?.full_name ?? user?.email ?? ''

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <Layout>
      <div className="p-5 pb-8">

        {/* Profile hero card */}
        <div
          className="rounded-3xl overflow-hidden mb-5"
          style={{ background: 'linear-gradient(145deg, #BF5E37 0%, #7A3418 100%)' }}
        >
          <div className="p-6 flex items-center gap-4">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.name}
                className="object-cover flex-shrink-0"
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2.5px solid rgba(212,168,83,0.5)',
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
                    {profile.name}
                  </p>
                  {profile.age && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
                      {profile.age} años
                    </p>
                  )}
                </>
              ) : (
                <Link to="/perfil" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'underline' }}>
                  + Agregar perfil familiar
                </Link>
              )}
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 6, letterSpacing: '0.03em' }}>
                Cuidado por {caretakerName}
              </p>
            </div>
          </div>
        </div>

        {/* Feature items */}
        <div className="space-y-3 mb-5">
          {MORE_ITEMS.map(({ to, Icon: IconComp, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 48, height: 48,
                  borderRadius: 15,
                  background: `${color}12`,
                }}
              >
                <IconComp size={22} color={color} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-gray-900 text-sm"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={16} color="#CCCCCC" strokeWidth={2} />
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
          style={{ border: '1px solid #FFBABA', background: '#FFF8F8', color: '#D63031' }}
        >
          <LogOut size={16} color="#D63031" strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </Layout>
  )
}
