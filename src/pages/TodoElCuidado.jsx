import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CompanionChat from '../components/CompanionChat'
import {
  ChevronLeft, Heart, Pill, Calendar, ClipboardList,
  MessageCircle, Video, Users, AlertTriangle, Phone, Info, FileText,
  Image, Pencil, DollarSign, Shield, Star, Settings,
} from '../components/Icons'

const SERIF = "'Fraunces', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

function GroupHeader({ icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      {icon}
      <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, color }}>{label}</span>
    </div>
  )
}

function ToolCard({ Icon, label, tint, tintBg, emphasis = false, onClick, span2 = false }) {
  const iconBg    = emphasis ? tint : tintBg
  const iconColor = emphasis ? '#FFFFFF' : tint
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: span2 ? '1 / -1' : undefined,
        background: 'white', border: 'none', borderRadius: 18,
        padding: '14px 10px 12px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8, cursor: 'pointer',
        boxShadow: `0 6px 14px -8px ${tint}55`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={iconColor} strokeWidth={1.8} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  )
}

export default function TodoElCuidado() {
  const navigate = useNavigate()
  const [showCompanion, setShowCompanion] = useState(false)

  const cuidarHoy = [
    { Icon: Pill,          label: 'Medicamentos',        onClick: () => navigate('/medications') },
    { Icon: Calendar,      label: 'Rutina diaria',       onClick: () => navigate('/cuidado') },
    { Icon: Heart,         label: 'Estado de salud',     onClick: () => navigate('/registros') },
    { Icon: ClipboardList, label: 'Historia de cuidado', onClick: () => navigate('/historial') },
  ]
  const familiaConectada = [
    { Icon: MessageCircle, label: 'Chat familiar',        onClick: () => navigate('/chat') },
    { Icon: Video,         label: 'Videollamada',         onClick: () => navigate('/videollamada') },
    { Icon: Users,         label: 'Familia y cuidadores', onClick: () => navigate('/familia') },
  ]
  const saludEmergencias = [
    { Icon: AlertTriangle, label: 'Modo emergencia',      tint: '#D9534F', tintBg: '#FBEAEA', emphasis: true,  onClick: () => navigate('/dashboard?sos=1') },
    { Icon: Phone,         label: 'Contactos médicos',    tint: '#087F70', tintBg: '#E5F4F1', emphasis: false, onClick: () => navigate('/directorio') },
    { Icon: Info,          label: 'Información médica',   tint: '#087F70', tintBg: '#E5F4F1', emphasis: false, onClick: () => navigate('/diario-medico') },
    { Icon: FileText,      label: 'Recetas y documentos', tint: '#087F70', tintBg: '#E5F4F1', emphasis: false, onClick: () => navigate('/reportes') },
  ]
  const vidaRecuerdos = [
    { Icon: Image,      label: 'Álbum',              onClick: () => navigate('/album') },
    { Icon: Pencil,     label: 'Notas de familia',   onClick: () => navigate('/paciente/notas-familia') },
    { Icon: DollarSign, label: 'Gastos del cuidado', onClick: () => navigate('/gastos') },
  ]
  const cuentaAjustes = [
    { Icon: Shield, label: 'Permisos de acceso',   onClick: () => navigate('/roles') },
    { Icon: Star,   label: 'Planes y suscripción', onClick: () => navigate('/pricing') },
  ]

  return (
    <Layout>
      <div style={{ fontFamily: SANS, color: '#334155' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 6px' }}>
          <button onClick={() => navigate(-1)} aria-label="Volver" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
            <ChevronLeft size={22} color="#334155" strokeWidth={2.2} />
          </button>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 19, color: '#334155', letterSpacing: '-0.01em' }}>Todo el cuidado</h1>
          <button aria-label="Favoritos" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
            <Heart size={19} color="#E9826E" strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: '8px 0 24px' }}>

          {/* 1. Cuidar hoy */}
          <div style={{ margin: '14px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: 'linear-gradient(180deg, #DCF0EA 0%, #E7F1EB 100%)' }}>
            <GroupHeader icon={<Heart size={15} color="#087F70" strokeWidth={1.9} />} color="#087F70" label="Cuidar hoy" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {cuidarHoy.map(c => <ToolCard key={c.label} {...c} tint="#087F70" tintBg="#EAF7F3" />)}
            </div>
          </div>

          {/* 2. Familia conectada */}
          <div style={{ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: 'linear-gradient(180deg, #FBEAE4 0%, #FCF0EC 100%)' }}>
            <GroupHeader icon={<Users size={15} color="#E9826E" strokeWidth={1.9} />} color="#E9826E" label="Familia conectada" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {familiaConectada.map((c, i) => (
                <ToolCard key={c.label} {...c} tint="#E9826E" tintBg="#FDEEEA" span2={i === familiaConectada.length - 1 && familiaConectada.length % 2 === 1} />
              ))}
            </div>
          </div>

          {/* 3. Salud y emergencias */}
          <div style={{ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: 'linear-gradient(180deg, #DCEEEC 0%, #E9F3F1 100%)' }}>
            <GroupHeader icon={<Shield size={15} color="#087F70" strokeWidth={1.9} />} color="#087F70" label="Salud y emergencias" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {saludEmergencias.map(c => <ToolCard key={c.label} {...c} />)}
            </div>
          </div>

          {/* 4. Vida y recuerdos */}
          <div style={{ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: 'linear-gradient(180deg, #FBF1DE 0%, #FCF4E7 100%)' }}>
            <GroupHeader icon={<Heart size={15} color="#D99A18" strokeWidth={1.9} />} color="#D99A18" label="Vida y recuerdos" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {vidaRecuerdos.map((c, i) => (
                <ToolCard key={c.label} {...c} tint="#D99A18" tintBg="#FDF3DF" span2={i === vidaRecuerdos.length - 1 && vidaRecuerdos.length % 2 === 1} />
              ))}
            </div>
          </div>

          {/* 5. Inteligencia FamiliaCerca */}
          <div style={{ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: 'linear-gradient(180deg, #ECE9F9 0%, #F1EFFB 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, color: '#7566D8' }}>Inteligencia FamiliaCerca</span>
            </div>
            <button
              onClick={() => setShowCompanion(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: '#EDEBFA', border: 'none', borderRadius: 18, padding: '14px 14px',
                boxShadow: '0 6px 16px -6px rgba(117,102,216,0.28)', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent', textAlign: 'left',
              }}
            >
              <span style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: '#DDD8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src="/images/milo-luna.webp" alt="Milo el perro y Luna la gata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: SERIF, fontWeight: 600, fontSize: 15, color: '#334155', marginBottom: 2 }}>Milo y Luna</span>
                <span style={{ display: 'block', fontSize: 12, color: '#6b7280', lineHeight: 1.35 }}>Tu asistente inteligente para el cuidado familiar</span>
              </span>
              <span style={{ fontSize: 18, color: '#7566D8', flexShrink: 0 }}>›</span>
            </button>
          </div>

          {/* 6. Cuenta y ajustes */}
          <div style={{ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: '#EFEFEE' }}>
            <GroupHeader icon={<Settings size={15} color="#6B7280" strokeWidth={1.9} />} color="#6B7280" label="Cuenta y ajustes" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {cuentaAjustes.map(c => <ToolCard key={c.label} {...c} tint="#6B7280" tintBg="#F0F0EF" />)}
            </div>
          </div>

        </div>
      </div>

      <CompanionChat externalOpen={showCompanion} onExternalClose={() => setShowCompanion(false)} bottomOffset={24} />
    </Layout>
  )
}
