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

const SERIF = "'Plus Jakarta Sans', system-ui, sans-serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

function GroupHeader({ icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      {icon}
      <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 18, color: '#14303D' }}>{label}</span>
    </div>
  )
}

function ToolCard({ Icon, label, sub, tint, tintBg, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'white', border: 'none', borderTop: '1px solid #F0EEE8',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        textAlign: 'left', WebkitTapHighlightColor: 'transparent', fontFamily: SANS,
      }}
    >
      <span style={{ width: 44, height: 44, borderRadius: 13, background: tintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={tint} strokeWidth={2.1} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#14303D', lineHeight: 1.3 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 14, color: '#4E6470', lineHeight: 1.35, marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ fontSize: 20, color: '#5E7480', flexShrink: 0 }}>›</span>
    </button>
  )
}

export default function TodoElCuidado() {
  const navigate = useNavigate()
  const [showCompanion, setShowCompanion] = useState(false)
  const [showHowIsToday, setShowHowIsToday] = useState(false)
  const { activePatientName } = useFamily()

  // Todo el cuidado en 4 grupos con nombres sencillos (nov 2026). Nada se
  // esconde: cada opción dice para qué sirve, así se encuentra sin adivinar.
  const groups = [
    { label: 'Día a día', Ic: Heart, tint: '#0C6C9C', bg: '#E3F1F8', items: [
      { Icon: Pill,     label: 'Medicinas',       sub: 'Dar, marcar y saber cuándo reponer', onClick: () => navigate('/medications') },
      { Icon: Calendar, label: 'Rutina del día',  sub: 'Baño, comidas, pañal, paseo', onClick: () => navigate('/cuidado') },
      { Icon: Heart,    label: '¿Cómo está hoy?', sub: 'Contar cómo amaneció o dejar una nota', onClick: () => setShowHowIsToday(true) },
      { Icon: Calendar, label: 'Citas',           sub: 'Próximas citas y quién lleva', onClick: () => navigate('/calendar') },
    ] },
    { label: 'Salud', Ic: FileText, tint: '#A3452F', bg: '#FDEEEA', items: [
      { Icon: FileText,      label: 'Reportes para el médico', sub: 'Un resumen para llevar a la consulta', onClick: () => navigate('/reportes') },
      { Icon: ClipboardList, label: 'Historial',               sub: 'Todo lo que pasó, día por día', onClick: () => navigate('/historial') },
      { Icon: Phone,         label: 'Contactos médicos',       sub: 'Médicos, farmacia, seguro', onClick: () => navigate('/directorio') },
      { Icon: FileText,      label: 'Datos de salud',          sub: 'Alergias, diagnósticos y la ficha de emergencia', onClick: () => navigate('/paciente/perfil') },
    ] },
    { label: 'Familia', Ic: Users, tint: '#0A5A82', bg: '#E3F1F8', items: [
      { Icon: Users,         label: 'Familia y cuidadores', sub: 'Quién está, tareas y turnos de la cuidadora', onClick: () => navigate('/familia') },
      { Icon: MessageCircle, label: 'Chat familiar',        sub: 'Hablar entre todos sin perder nada', onClick: () => navigate('/chat') },
      { Icon: Video,         label: 'Videollamada',         sub: 'Acompañar desde lejos', onClick: () => navigate('/videollamada') },
      { Icon: Pencil,        label: 'Memorias de voz',      sub: 'Guardar sus historias y recuerdos', onClick: () => navigate('/memorias') },
    ] },
    { label: 'Dinero', Ic: DollarSign, tint: '#B07A12', bg: '#FDF3DF', items: [
      { Icon: DollarSign, label: 'Gastos del cuidado', sub: 'Quién pagó y cuánto le toca a cada uno', onClick: () => navigate('/gastos') },
    ] },
  ]
  const cuenta = [
    { Icon: Settings, label: 'Mi cuenta y ajustes', sub: 'Tu familia, avisos, letra grande', onClick: () => navigate('/ajustes') },
    { Icon: Star,     label: 'Planes y suscripción', sub: 'Lo que incluye cada plan', onClick: () => navigate('/upgrade') },
  ]

  // Grupos separados por un título, sin fondo de color (UX nov 2026)
  const block = () => ({ margin: '22px 16px 0' })
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  return (
    <Layout>
      <div style={{ fontFamily: SANS, color: '#2A4350' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 18px 6px' }}>
          <button onClick={() => navigate(-1)} aria-label="Volver" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
            <ChevronLeft size={22} color="#2A4350" strokeWidth={2.2} />
          </button>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 800, fontSize: 22, color: '#14303D', letterSpacing: '-0.02em' }}>Todo el cuidado</h1>
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
              <span style={{ fontSize: 15, opacity: 0.9 }}>Avisa a toda la familia ›</span>
            </button>
            <button
              onClick={() => navigate('/dashboard?ficha=1')}
              style={{ marginTop: 8, width: '100%', padding: '12px 16px', borderRadius: 14, border: '1.5px solid #E6E3DB', background: 'white', color: '#B42318', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
            >
              📋 Ficha médica para los paramédicos ›
            </button>
          </div>

          {groups.map(g => (
            <div key={g.label} style={block()}>
              <GroupHeader icon={<g.Ic size={16} color={g.tint} strokeWidth={2.1} />} label={g.label} />
              <div style={{ background: 'white', border: '1px solid #E6E3DB', borderRadius: 18, overflow: 'hidden' }}>
                {g.items.map(c => <ToolCard key={c.label} {...c} tint={g.tint} tintBg={g.bg} />)}
              </div>
            </div>
          ))}

          {/* Milo y Luna */}
          <div style={block('linear-gradient(180deg, #E3F1F8 0%, #EEF6FA 100%)')}>
            <button
              onClick={() => setShowCompanion(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, background: 'white', border: '1px solid #E6E3DB', borderRadius: 18, padding: '14px 14px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left' }}
            >
              <span style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: '#CDE8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src="/images/milo-luna.webp" alt="Milo el perro y Luna la gata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: SERIF, fontWeight: 600, fontSize: 17, color: '#2A4350', marginBottom: 2 }}>Milo y Luna</span>
                <span style={{ display: 'block', fontSize: 15, color: '#4E6470', lineHeight: 1.35 }}>Pregúntales lo que sea, o mándales la foto de un papel en inglés</span>
              </span>
              <span style={{ fontSize: 20, color: '#0C6C9C', flexShrink: 0 }}>›</span>
            </button>
          </div>

          {/* Mi cuenta */}
          <div style={block()}>
            <GroupHeader icon={<Settings size={16} color="#4E6470" strokeWidth={2.1} />} label="Mi cuenta" />
            <div style={{ background: 'white', border: '1px solid #E6E3DB', borderRadius: 18, overflow: 'hidden' }}>
              {cuenta.map(c => <ToolCard key={c.label} {...c} tint="#4E6470" tintBg="#F0F0EF" />)}
            </div>
          </div>

        </div>
      </div>

      <HowIsTodaySheet open={showHowIsToday} onClose={() => setShowHowIsToday(false)} patientName={activePatientName?.split(' ')[0]} />
      <CompanionChat externalOpen={showCompanion} onExternalClose={() => setShowCompanion(false)} bottomOffset={24} />
    </Layout>
  )
}
