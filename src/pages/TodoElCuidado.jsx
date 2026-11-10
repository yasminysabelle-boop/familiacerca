import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CompanionChat from '../components/CompanionChat'
import HowIsTodaySheet from '../components/HowIsTodaySheet'
import { useFamily } from '../contexts/FamilyContext'
import {
  ChevronLeft, Heart, Pill, Calendar, ClipboardList,
  MessageCircle, Video, Users, AlertTriangle, Phone, FileText,
  Pencil, DollarSign, Shield, Star, Settings,
} from '../components/Icons'

const SERIF = "'Fraunces', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

function GroupHeader({ icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      {icon}
      <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, color }}>{label}</span>
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
      <span style={{ fontSize: 14, fontWeight: 600, color: '#2A4350', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  )
}

export default function TodoElCuidado() {
  const navigate = useNavigate()
  const [showCompanion, setShowCompanion] = useState(false)
  const [showHowIsToday, setShowHowIsToday] = useState(false)
  const { activePatientName } = useFamily()

  // Funciones en 3 niveles (UX nov 2026): lo de todos los días arriba, lo de
  // vez en cuando después, y lo de momentos especiales plegado. Emergencia
  // siempre visible.
  const [showMore, setShowMore] = useState(() => {
    try { return localStorage.getItem('fc_mas_expandido') === '1' } catch { return false }
  })
  function toggleMore() {
    const v = !showMore
    setShowMore(v)
    try { localStorage.setItem('fc_mas_expandido', v ? '1' : '0') } catch { /* sin almacenamiento */ }
  }

  const todosLosDias = [
    { Icon: Pill,     label: 'Medicamentos',         onClick: () => navigate('/medications') },
    { Icon: Calendar, label: 'Rutina diaria',        onClick: () => navigate('/cuidado') },
    // Una sola puerta para todo lo que se escribe del familiar (HowIsTodaySheet)
    { Icon: Heart,    label: '¿Cómo está hoy?',      onClick: () => setShowHowIsToday(true) },
    { Icon: Users,    label: 'Familia y cuidadores', onClick: () => navigate('/familia') },
  ]
  const organizar = [
    { Icon: Calendar,      label: 'Citas y calendario',      onClick: () => navigate('/calendar') },
    { Icon: FileText,      label: 'Reportes para el médico', onClick: () => navigate('/reportes') },
    { Icon: Phone,         label: 'Contactos médicos',       onClick: () => navigate('/directorio') },
    { Icon: Video,         label: 'Videollamada',            onClick: () => navigate('/videollamada') },
    { Icon: ClipboardList, label: 'Historia de cuidado',     onClick: () => navigate('/historial') },
    { Icon: MessageCircle, label: 'Chat familiar',           onClick: () => navigate('/chat') },
  ]
  const especiales = [
    { Icon: DollarSign, label: 'Gastos del cuidado', onClick: () => navigate('/gastos') },
    { Icon: Pencil,     label: 'Memorias de voz',    onClick: () => navigate('/memorias') },
  ]
  const cuenta = [
    { Icon: Settings, label: 'Mi cuenta y ajustes',  onClick: () => navigate('/ajustes') },
    { Icon: Shield,   label: 'Quién ve qué',   onClick: () => navigate('/roles') },
    { Icon: Star,     label: 'Planes y suscripción', onClick: () => navigate('/upgrade') },
  ]

  const block = (bg) => ({ margin: '12px 14px 0', padding: '16px 14px 18px', borderRadius: 22, background: bg })
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  return (
    <Layout>
      <div style={{ fontFamily: SANS, color: '#2A4350' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 18px 6px' }}>
          <button onClick={() => navigate(-1)} aria-label="Volver" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
            <ChevronLeft size={22} color="#2A4350" strokeWidth={2.2} />
          </button>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 21, color: '#2A4350', letterSpacing: '-0.01em' }}>Todo el cuidado</h1>
        </div>

        <div style={{ padding: '8px 0 24px' }}>

          {/* Emergencia — siempre a un toque */}
          <div style={{ margin: '10px 14px 0' }}>
            <button
              onClick={() => navigate('/dashboard?sos=1')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, border: 'none', background: '#D9534F', color: 'white', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(217,83,79,0.7)', WebkitTapHighlightColor: 'transparent' }}
            >
              <AlertTriangle size={22} color="#FFFFFF" strokeWidth={2} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 17, fontWeight: 700 }}>Emergencia</span>
              <span style={{ fontSize: 14, opacity: 0.9 }}>Avisa a toda la familia ›</span>
            </button>
          </div>

          {/* 1. Todos los días */}
          <div style={block('linear-gradient(180deg, #E3F1F8 0%, #EEF6FA 100%)')}>
            <GroupHeader icon={<Heart size={16} color="#0C6C9C" strokeWidth={1.9} />} color="#0C6C9C" label="Todos los días" />
            <div style={grid}>
              {todosLosDias.map(c => <ToolCard key={c.label} {...c} tint="#0C6C9C" tintBg="#E3F1F8" />)}
            </div>
          </div>

          {/* 2. Organizar (de vez en cuando) */}
          <div style={block('linear-gradient(180deg, #FBEAE4 0%, #FCF0EC 100%)')}>
            <GroupHeader icon={<Calendar size={16} color="#C9654F" strokeWidth={1.9} />} color="#C9654F" label="Organizar" />
            <div style={grid}>
              {organizar.map(c => <ToolCard key={c.label} {...c} tint="#C9654F" tintBg="#FDEEEA" />)}
            </div>
          </div>

          {/* Milo y Luna */}
          <div style={block('linear-gradient(180deg, #E3F1F8 0%, #EEF6FA 100%)')}>
            <button
              onClick={() => setShowCompanion(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, background: '#E3F1F8', border: 'none', borderRadius: 18, padding: '14px 14px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left' }}
            >
              <span style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: '#CDE8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src="/images/milo-luna.webp" alt="Milo el perro y Luna la gata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: SERIF, fontWeight: 600, fontSize: 17, color: '#2A4350', marginBottom: 2 }}>Milo y Luna</span>
                <span style={{ display: 'block', fontSize: 14, color: '#4E6470', lineHeight: 1.35 }}>Pregúntales lo que necesites del cuidado</span>
              </span>
              <span style={{ fontSize: 20, color: '#0C6C9C', flexShrink: 0 }}>›</span>
            </button>
          </div>

          {/* 3. Cuando haga falta (plegado) */}
          <div style={block('#F4F2EC')}>
            <button onClick={toggleMore} aria-expanded={showMore} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, color: '#4E6470' }}>Cuando haga falta</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0C6C9C' }}>{showMore ? 'Ocultar ▲' : 'Ver gastos y memorias ▼'}</span>
            </button>
            {showMore && (
              <div style={{ ...grid, marginTop: 12 }}>
                {especiales.map(c => <ToolCard key={c.label} {...c} tint="#B07A12" tintBg="#FDF3DF" />)}
              </div>
            )}
          </div>

          {/* 4. Mi cuenta */}
          <div style={block('#EFEFEE')}>
            <GroupHeader icon={<Settings size={16} color="#4E6470" strokeWidth={1.9} />} color="#4E6470" label="Mi cuenta" />
            <div style={grid}>
              {cuenta.map((c, i) => <ToolCard key={c.label} {...c} tint="#4E6470" tintBg="#F0F0EF" span2={i === 0} />)}
            </div>
          </div>

        </div>
      </div>

      <HowIsTodaySheet open={showHowIsToday} onClose={() => setShowHowIsToday(false)} patientName={activePatientName?.split(' ')[0]} />
      <CompanionChat externalOpen={showCompanion} onExternalClose={() => setShowCompanion(false)} bottomOffset={24} />
    </Layout>
  )
}
