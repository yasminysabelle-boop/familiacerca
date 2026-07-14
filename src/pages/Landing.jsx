import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePWAInstall } from '../hooks/usePWAInstall'
import InstallBanner from '../components/InstallBanner'
import CompanionChat from '../components/CompanionChat'

const HERO_IMG = '/images/hero.jpg'
const PROB_IMG = '/images/familia-telefonos-noche.webp'
const COMO_IMG = '/images/como.jpg'
const CTA_IMG  = '/images/cta.jpg'
const MILO_LUNA_IMG = '/images/milo-luna.webp'

const PRIMARY = '#143C32'
const ACTION  = '#0d6b63'
const CREAM   = '#F8F4ED'
const SAND    = '#EDE5D8'
const GOLD    = '#E9826E'
const CORAL   = '#E9826E'
const MINT_C  = '#EBF3EE'
const DARK    = '#143C32'
const WHITE   = '#FFFFFF'
const BORDER  = 'rgba(13,107,99,0.12)'

const SERIF = "'Cormorant Garamond', Georgia, serif"
const SANS  = "'Inter', system-ui, sans-serif"

function CTABtn({ to, children, style = {} }) {
  return (
    <Link to={to} className="cta-coral" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '18px 52px', borderRadius: 9999,
      background: '#E9826E',
      color: 'white', fontWeight: 500, fontSize: 18,
      textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.025em',
      boxShadow: '0 12px 40px rgba(233,130,110,0.38)',
      transition: 'background 0.2s ease',
      ...style,
    }}>
      {children}
    </Link>
  )
}

function FAQItem({ q, a, light = false, onTrack }) {
  const [open, setOpen] = useState(false)
  const textColor   = light ? '#143C32' : 'rgba(255,255,255,0.82)'
  const answerColor = light ? '#6B7280' : 'rgba(255,255,255,0.50)'
  const borderColor = light ? 'rgba(13,107,99,0.18)' : `rgba(233,130,110,0.12)`
  const iconBorder  = light ? 'rgba(13,107,99,0.35)' : `rgba(233,130,110,0.40)`
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && onTrack) onTrack('faq_open', { question: q })
  }
  return (
    <div className={light ? 'faq-light-item' : 'faq-dark-item'} style={{ borderBottom: `1px solid ${borderColor}` }}>
      <button
        onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 18, fontWeight: 400, color: textColor, lineHeight: 1.5, paddingRight: 16, fontFamily: SANS }}>{q}</span>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${iconBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: light ? ACTION : GOLD, flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 17, color: answerColor, lineHeight: 1.85, padding: '0 16px 24px', margin: 0, fontFamily: SANS, fontWeight: 300 }}>{a}</p>
        </div>
      </div>
    </div>
  )
}

function PriceCard({ name, price, period, highlight, badge, features, cta, annual, trackId, onTrack, tagline }) {
  const displayPrice = annual && price > 0 ? (price * 0.8).toFixed(2) : price
  return (
    <div
      className={`price-card-hover${highlight ? ' price-card-highlighted' : ''}`}
      style={{ flex: '1 1 280px', borderRadius: 24, background: highlight ? ACTION : WHITE, padding: '44px 32px', boxShadow: highlight ? '0 32px 96px rgba(13,107,99,0.35)' : '0 4px 28px rgba(0,0,0,0.07)', border: highlight ? 'none' : `1px solid ${BORDER}`, position: 'relative', display: 'flex', flexDirection: 'column' }}
    >
      {badge && (
        <div className={highlight ? 'badge-pulse-anim' : ''} style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: 'white', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', padding: '6px 22px', borderRadius: 9999, whiteSpace: 'nowrap', fontFamily: SANS }}>{badge}</div>
      )}
      <p style={{ fontSize: 10, fontWeight: 500, color: highlight ? 'rgba(255,255,255,0.55)' : ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 12px', fontFamily: SANS }}>{name}</p>
      {tagline && <p style={{ fontSize: 14, color: highlight ? 'rgba(255,255,255,0.65)' : '#6B7280', margin: '0 0 16px', fontFamily: SANS, fontWeight: 400, lineHeight: 1.4 }}>{tagline}</p>}
      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 52, fontWeight: 700, color: highlight ? 'white' : DARK, fontFamily: SERIF, lineHeight: 1 }}>{price === 0 ? 'Gratis' : `$${displayPrice}`}</span>
        {price > 0 && <span style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#6B7280', fontFamily: SANS }}>/mes</span>}
      </div>
      {annual && price > 0 && (
        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.30)' : '#6B7280', textDecoration: 'line-through', fontFamily: SANS }}>${price}/mes</span>
          <span style={{ fontSize: 11, background: MINT_C, color: DARK, borderRadius: 4, padding: '2px 8px', fontFamily: SANS, fontWeight: 500 }}>-20%</span>
        </div>
      )}
      <p style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#6B7280', margin: '0 0 28px', fontFamily: SANS, fontWeight: 300 }}>{annual && price > 0 ? 'facturado anualmente' : period}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, fontFamily: SANS, fontWeight: 300 }}>
            <span style={{ color: f.included ? (highlight ? GOLD : ACTION) : (highlight ? 'rgba(255,255,255,0.20)' : '#6B7280'), flexShrink: 0, fontWeight: 500 }}>{f.included ? '✓' : '–'}</span>
            <span style={{ color: f.included ? (highlight ? 'rgba(255,255,255,0.85)' : '#6B7280') : (highlight ? 'rgba(255,255,255,0.30)' : '#6B7280') }}>{f.text}</span>
          </li>
        ))}
      </ul>
      <Link to="/register" onClick={() => onTrack && onTrack('pricing_click', { plan: trackId })} style={{ display: 'block', textAlign: 'center', padding: '16px', borderRadius: 9999, fontWeight: 500, fontSize: 15, textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em', background: highlight ? 'white' : 'transparent', color: ACTION, border: highlight ? 'none' : `1.5px solid ${ACTION}`, boxShadow: highlight ? '0 8px 24px rgba(255,255,255,0.18)' : 'none' }}>{cta}</Link>
    </div>
  )
}

export default function Landing() {
  const { user, loading } = useAuth()
  const { installed, isIOS, isAndroid, canPrompt, install, isMobile } = usePWAInstall()
  const [pwaTab, setPwaTab] = useState(() => isAndroid ? 'android' : 'iphone')
  const [pwaInstallClicked, setPwaInstallClicked] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [annual, setAnnual] = useState(false)
  const [showBar, setShowBar] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showAllTestimonials, setShowAllTestimonials] = useState(false)

  useEffect(() => {
    if (document.getElementById('landing-gfonts')) return
    const pc1 = document.createElement('link'); pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com'; document.head.appendChild(pc1)
    const pc2 = document.createElement('link'); pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = 'anonymous'; document.head.appendChild(pc2)
    const lk = document.createElement('link'); lk.id = 'landing-gfonts'; lk.rel = 'stylesheet'
    lk.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Inter:wght@300;400;500;600&display=swap'
    document.head.appendChild(lk)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view') }),
      { threshold: 0.10, rootMargin: '0px 0px -32px 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 150)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const navLinks = [
    { label: 'Funciones', href: '#funciones' },
    { label: 'Cómo funciona', href: '#como' },
    { label: 'Precios', href: '#precios' },
    { label: 'Preguntas', href: '#faq' },
  ]

  // Restaurar métricas reales cuando existan datos de producción
  const statItems = [
    { icon: '⚡', val: '3 minutos', label: 'para empezar' },
    { icon: '🔒', val: 'Sin tarjeta', label: 'de crédito' },
    { icon: '👨‍👩‍👧', val: 'Tu familia', label: 'conectada en un solo lugar' },
  ]

  const marqueePain = [
    '✓ Ya no discutimos sobre los medicamentos',
    '✓ Sin más WhatsApp caótico',
    '✓ Todos ven el historial',
    '✓ Nunca más ¿ya le diste la pastilla?',
    '✓ Coordinamos desde distintas ciudades',
    '✓ Alerta clínica si se olvida una dosis',
    '✓ Confirmación con foto de prueba',
    '✓ Gratis para empezar',
  ]

  const marqueeFeatures = [
    '💊 Ventana clínica ±1h',
    '📋 Historial médico',
    '🆘 SOS instantáneo',
    '📅 Citas con recordatorio',
    '📸 Confirmación con foto',
    '📄 PDF para el médico',
  ]

  const track = (event, params = {}) => {
    if (typeof window !== 'undefined' && window.gtag) window.gtag('event', event, params)
  }

  const plans = [
    {
      name: 'Gratis', price: 0, period: 'Para siempre sin costo', highlight: false,
      trackId: 'gratis', tagline: 'Empieza a coordinar',
      features: [
        { text: 'Hasta 2 cuidadores', included: true },
        { text: 'Medicamentos ilimitados', included: true },
        { text: 'Checklist diario', included: true },
        { text: 'Chat familiar', included: true },
        { text: 'Historial 3 días', included: true },
        { text: 'Foto de prueba', included: false },
        { text: 'Alerta clínica ±1h', included: false },
        { text: 'Push notifications', included: false },
        { text: 'Citas médicas', included: false },
        { text: 'Notas de voz', included: false },
        { text: 'Exportar PDF', included: false },
      ],
      cta: 'Empezar gratis',
    },
    {
      name: 'Familiar', price: 12.99, period: 'Hasta 6 cuidadores',
      highlight: true, badge: 'Más popular', trackId: 'familiar', tagline: 'Para familias que necesitan más tranquilidad',
      features: [
        { text: 'Hasta 6 cuidadores', included: true },
        { text: 'Todo del plan Gratis', included: true },
        { text: 'Alerta clínica ±1h', included: true },
        { text: 'Dosis olvidada bloqueada', included: true },
        { text: 'Foto de prueba', included: true },
        { text: 'Push SOS + recordatorios', included: true },
        { text: 'Citas con adjuntos', included: true },
        { text: 'Chat categorizado 🏥🚨', included: true },
        { text: 'Notas de voz', included: true },
        { text: 'Historial 90 días', included: true },
        { text: 'PDF export + Álbum memorias', included: true },
      ],
      cta: 'Empezar gratis',
    },
    {
      name: 'Cuidado Total', price: 24.99, period: 'Cuidadores ilimitados', highlight: false,
      trackId: 'total', tagline: 'Para el cuidado más completo, sin límites.',
      features: [
        { text: 'Cuidadores ilimitados', included: true },
        { text: 'Todo del plan Familiar', included: true },
        { text: 'Registros médicos e incidentes', included: true },
        { text: 'Directorio médico', included: true },
        { text: 'Gastos de salud', included: true },
        { text: 'Milo/Luna IA', included: true },
        { text: 'Historial indefinido', included: true },
        { text: 'Soporte prioritario', included: true },
        { text: 'Acceso anticipado a funciones', included: true },
      ],
      cta: 'Empezar gratis',
    },
  ]

  const faqs = [
    { q: '¿Necesito crear una cuenta para usar FamiliaCerca?', a: 'Sí, necesitas una cuenta gratuita para empezar. El registro tarda menos de un minuto — solo tu correo y contraseña. No pedimos tarjeta de crédito para el plan Gratis.' },
    { q: '¿Cuántas personas pueden usar la misma cuenta familiar?', a: 'El plan Gratis permite hasta 2 miembros. El plan Familiar soporta hasta 6 cuidadores y el plan Cuidado Total es ilimitado. Todos ven actualizaciones en tiempo real.' },
    { q: '¿Funciona sin conexión a internet?', a: 'FamiliaCerca es una PWA (app web progresiva). Una vez instalada, muchas funciones como el checklist del día y los medicamentos están disponibles sin conexión. Los cambios se sincronizan cuando vuelve la señal.' },
    { q: '¿Cómo se instala en el celular si no está en la App Store?', a: 'En iPhone: abre la página en Safari, toca el botón de compartir (cuadro con flecha) y selecciona "Agregar a inicio". En Android: toca el menú de tres puntos del navegador y selecciona "Instalar aplicación".' },
    { q: '¿Mis datos médicos están protegidos?', a: 'Sí. Tus datos se almacenan cifrados en infraestructura de nivel empresarial — la misma tecnología que usan bancos y hospitales. Solo los familiares que tú invites tienen acceso. Nunca vendemos ni compartimos tu información.' },
    { q: '¿Puedo cancelar mi suscripción en cualquier momento?', a: 'Por supuesto. Puedes cancelar desde Ajustes > Suscripción en cualquier momento. No hay penalizaciones ni contratos. Tu plan baja a Gratis al terminar el período pagado.' },
  ]

  const testimonials = [
    { name: 'María G.',    initial: 'M', role: 'Hija cuidadora',         location: 'Houston, Texas',          headline: 'Se acabaron las discusiones familiares',                text: 'Antes mi hermano y yo nos peleábamos porque ninguno sabía si mamá ya había tomado su pastilla. Ahora con FamiliaCerca todos vemos lo mismo. ¡Nos salvó la convivencia familiar!' },
    { name: 'Roberto S.',  initial: 'R', role: 'Hijo mayor',              location: 'Los Ángeles, California', headline: 'Por fin tenemos evidencia de todo',                      text: 'La función de foto de prueba fue un cambio total. Ahora tenemos evidencia de cada medicamento y podemos mostrársela al cardiólogo. El doctor quedó impresionado con el registro.' },
    { name: 'Carmen L.',   initial: 'C', role: 'Enfermera, uso personal', location: 'Miami, Florida',         headline: 'La foto de confirmación cambió nuestra dinámica',        text: 'Llevo 15 años como enfermera y nunca había visto una app tan práctica para el cuidado en casa. La recomiendo a todas las familias de mis pacientes.' },
    { name: 'Patricia V.', initial: 'P', role: 'Coordinadora familiar',   location: 'San Juan, Puerto Rico',  headline: 'Antes nadie sabía quién había dado la medicina',          text: 'Somos 4 hermanos en distintos estados cuidando a nuestro papá. FamiliaCerca nos unió. Cada uno sabe qué le toca y cuándo. Ya no hay excusas ni confusiones.' },
    { name: 'Jorge M.',    initial: 'J', role: 'Esposo cuidador',         location: 'Nueva York, NY',         headline: 'Ahora todos estamos tranquilos',                          text: 'Mi esposa tiene Alzheimer y el checklist diario me salvó. Puedo registrar cada comida, cada baño, cada medicamento. Por fin duermo tranquilo sabiendo que nada se me escapa.' },
    { name: 'Lucía R.',    initial: 'L', role: 'Hija única',              location: 'Chicago, Illinois',      headline: 'Mi mamá está mejor atendida y nosotros más organizados', text: 'Cuido sola a mis dos padres mayores desde hace 3 años. FamiliaCerca me ayuda a organizarme y el botón SOS me da tranquilidad cuando no estoy en casa. No sé cómo lo hacía antes.' },
  ]

  return (
    <div style={{ background: WHITE, color: DARK, overflowX: 'hidden', fontFamily: SANS }}>

      {/* ─────────────── 1. NAV ─────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: '#F8F4ED', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(20,60,50,0.08)', boxShadow: '0 1px 8px rgba(20,60,50,0.06)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '20px 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink: 0 }}>
            <img src="/logo.png" alt="FamiliaCerca" style={{ width: 44, height: 44, objectFit: 'contain', display: 'block' }} />
            <span style={{ fontFamily:'Georgia,serif', fontWeight:700, margin:0, padding:0 }}>
              <span style={{ color:'#143C32', fontSize:'26px' }}>Familia</span>
              <span style={{ color:'#E9826E', fontSize:'26px' }}>Cerca</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="landing-desktop-nav">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 16, fontWeight: 400, color: '#143C32', textDecoration: 'none', fontFamily: SANS }}
                onMouseEnter={e => e.currentTarget.style.color = '#E9826E'}
                onMouseLeave={e => e.currentTarget.style.color = '#143C32'}
              >{l.label}</a>
            ))}
            <Link to="/login" className="btn-nav-cream" style={{ padding: '10px 28px', borderRadius: 9999, border: '1.5px solid #143C32', background: 'transparent', color: '#143C32', fontWeight: 500, fontSize: 16, textDecoration: 'none', fontFamily: SANS }}>
              Iniciar sesión
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(o => !o)} className="landing-hamburger"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}
            aria-label="Menú">
            {[0,1,2].map(i => <div key={i} style={{ width: 22, height: 1.5, background: '#143C32', borderRadius: 2 }} />)}
          </button>
        </div>

        {mobileMenuOpen && (
          <div style={{ padding: '12px 32px 24px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid rgba(20,60,50,0.08)', background: '#F8F4ED' }}>
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '13px 8px', fontSize: 15, color: '#143C32', textDecoration: 'none', fontFamily: SANS }}>
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-nav-cream" style={{ marginTop: 10, padding: '16px', borderRadius: 9999, textAlign: 'center', border: '1.5px solid #143C32', background: 'transparent', color: '#143C32', fontWeight: 500, fontSize: 16, textDecoration: 'none', fontFamily: SANS }}>
              Iniciar sesión
            </Link>
          </div>
        )}
      </nav>

      {/* ─────────────── 2. HERO ─────────────── */}
      <section style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }} className="landing-hero-grid">

        {/* Left dark panel */}
        <div className="landing-hero-text" style={{ background: PRIMARY, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 'clamp(80px,8vw,120px) clamp(32px,5vw,72px)', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 55% at 30% 55%, rgba(13,107,99,0.22) 0%, transparent 70%)' }} />

          <div style={{ position: 'relative', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="hero-reveal hero-delay-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(13,107,99,0.40)', borderRadius: 9999, padding: '7px 18px', marginBottom: 36, background: 'rgba(13,107,99,0.14)' }}>
              <span style={{ fontSize: 13 }}>🌿</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: MINT_C, letterSpacing: '0.06em', fontFamily: SANS }}>Cuidado familiar coordinado</span>
            </div>

            <h1 className="hero-reveal hero-delay-2" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(40px, 5.5vw, 78px)', fontWeight: 700, color: WHITE, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: '-1px', textAlign: 'center' }}>
              Cuida a quien amas,{' '}
              <span style={{ color: GOLD }}>sin perder ningún detalle.</span>
            </h1>

            <p className="hero-reveal hero-delay-3" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(24px, 3.2vw, 38px)', fontWeight: 600, color: GOLD, lineHeight: 1.25, margin: '0 0 20px' }}>
              ¿Ya se lo dieron?
            </p>

            <p className="hero-reveal hero-delay-3" style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 40px', fontFamily: SANS, fontWeight: 300, textAlign: 'center' }}>
              La información del cuidado se pierde entre chats, llamadas y suposiciones.
            </p>

            <Link to="/register" className="hero-reveal hero-delay-4 cta-coral" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 48px', borderRadius: 9999, marginBottom: 32, background: '#E9826E', color: WHITE, fontWeight: 600, fontSize: 18, fontFamily: SANS, textDecoration: 'none', letterSpacing: '0.02em', boxShadow: '0 12px 40px rgba(233,130,110,0.45)', transition: 'background 0.2s ease' }}>
              Empezar gratis <span style={{ fontSize: 18, opacity: 0.85 }}>→</span>
            </Link>

            <div className="hero-reveal hero-delay-5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', fontWeight: 300, fontFamily: SANS }}>
                <span style={{ color: MINT_C, fontWeight: 600 }}>✓</span> Sin tarjeta{' '}
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>{' '}
                <span style={{ color: MINT_C, fontWeight: 600 }}>✓</span> iPhone y Android{' '}
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>{' '}
                <span style={{ color: MINT_C, fontWeight: 600 }}>✓</span> Sin app store
              </span>
            </div>
          </div>
        </div>

        {/* Right: photo + floating medication card */}
        <div className="landing-hero-right" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
          <img src={HERO_IMG} alt="Familia cuidando juntos" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to right, rgba(20,60,50,0.38) 0%, transparent 30%)', pointerEvents: 'none' }} />

          {/* Floating status card */}
          <div className="hero-reveal hero-delay-4" style={{
            position:'absolute', bottom:'2rem', right:'1.5rem',
            background:'#F8F4ED', borderRadius:'24px',
            padding:'18px 22px', boxShadow:'0 8px 32px rgba(20,60,50,0.15)',
            minWidth:'255px', maxWidth:'285px', zIndex: 4
          }}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#EBF3EE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'17px'}}>👵</div>
              <div>
                <div style={{fontWeight:700,fontSize:'14px',color:'#143C32'}}>Deborah</div>
                <div style={{display:'flex',alignItems:'center',gap:'5px',marginTop:'2px'}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:'#143C32'}}></div>
                  <span style={{fontSize:'11px',color:'#143C32',fontWeight:600}}>Todo al día</span>
                </div>
              </div>
            </div>
            {[
              {icon:'💊',text:'Medicamentos completados'},
              {icon:'🕙',text:'Última actualización 10:45 AM'},
              {icon:'👨‍👩‍👧',text:'4 familiares informados'},
            ].map((item,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'7px'}}>
                <span style={{fontSize:'13px'}}>{item.icon}</span>
                <span style={{fontSize:'11px',color:'#143C32',opacity:0.8}}>{item.text}</span>
                <span style={{marginLeft:'auto',color:'#143C32',fontSize:'12px',fontWeight:700}}>✓</span>
              </div>
            ))}
            <div style={{borderTop:'1px solid rgba(20,60,50,0.1)',marginTop:'8px',paddingTop:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'10px',color:'#143C32',opacity:0.6}}>Actualizado por Rosa</span>
              <span style={{fontSize:'10px',color:'#E9826E',fontWeight:600}}>Hace 15 min</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── 3. MARQUEE 1 ─────────────── */}
      <section style={{ background: DARK, padding: '20px 0', overflow: 'hidden', borderTop: `1px solid rgba(233,130,110,0.08)` }}>
        <div className="marquee-container">
          <div className="marquee-track">
            {[...marqueePain, ...marqueePain].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 32px', whiteSpace: 'nowrap', fontSize: 14, color: GOLD, fontFamily: SANS, fontWeight: 400 }}>
                {item}
                <span style={{ color: `rgba(233,130,110,0.30)`, fontSize: 18, lineHeight: 1 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── 4. STATS ─────────────── */}
      <section style={{ background: CREAM, padding: '72px 32px', borderBottom: `1px solid ${BORDER}` }}>
        <div className="stats-grid" style={{ maxWidth: 1140, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {statItems.map((s, i) => (
            <div key={i} className="stats-grid-cell" style={{ textAlign: 'center', padding: '0 32px', borderLeft: i > 0 ? '1px solid rgba(13,107,99,0.22)' : 'none' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
              <p style={{ margin: 0, fontFamily: SERIF, fontSize: 'clamp(30px, 3.6vw, 50px)', fontWeight: 700, color: ACTION, lineHeight: 1.1 }}>{s.val}</p>
              <p style={{ margin: '10px 0 0', fontSize: 15, fontFamily: SANS, fontWeight: 300, color: '#6B7280', letterSpacing: '0.02em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────── 5. PROBLEM SPLIT ─────────────── */}
      <section style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="landing-problema-grid">
          <div style={{ position: 'relative', minHeight: 700, overflow: 'hidden' }} className="landing-problema-img">
            <img src={PROB_IMG} alt="El reto del cuidado familiar" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
          <div style={{ background: PRIMARY, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(56px,8vw,96px) clamp(36px,6vw,80px)' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>El problema</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 600, color: WHITE, lineHeight: 1.12, margin: '0 0 44px' }}>
              El problema no es cuidar a tu familiar. El problema es que nadie sabe qué está pasando.
            </h2>

            <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              <div>
                <p style={{ margin: '0 0 6px', fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: GOLD, letterSpacing: '0.04em' }}>8:30 PM</p>
                <p style={{ margin: 0, fontSize: 18, color: 'rgba(255,255,255,0.82)', fontFamily: SANS, fontWeight: 400, lineHeight: 1.6 }}>
                  Tu mamá necesita su medicación.
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: GOLD, letterSpacing: '0.04em' }}>8:47 PM</p>
                <p style={{ margin: 0, fontSize: 17, color: 'rgba(255,255,255,0.62)', fontFamily: SANS, fontWeight: 300, lineHeight: 1.7 }}>
                  Un hermano cree que ya se la dieron. Otro no está seguro. El cuidador no respondió el WhatsApp.
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: GOLD, letterSpacing: '0.04em' }}>9:12 PM</p>
                <p style={{ margin: 0, fontSize: 17, color: 'rgba(255,255,255,0.62)', fontFamily: SANS, fontWeight: 300, lineHeight: 1.7 }}>
                  El historial está perdido entre mensajes. La responsabilidad se diluye. Y tú cargas con la duda.
                </p>
              </div>
            </div>

            <p className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(24px,2.8vw,34px)', fontWeight: 600, color: GOLD, lineHeight: 1.3, margin: '40px 0 0' }}>
              Esto no es falta de amor. Es falta de sistema.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────── 5.5. LA SOLUCIÓN ─────────────── */}
      <section style={{ background: CREAM, padding: 'clamp(96px,14vw,168px) 32px' }}>
        <div className="reveal" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(22px,2.6vw,32px)', fontWeight: 600, color: CORAL, lineHeight: 1.35, margin: '0 0 48px' }}>
            La solución no es más mensajes. Es tener un sistema.
          </p>
          <p style={{ fontFamily: SERIF, fontWeight: 700, margin: '0 0 28px', padding: 0 }}>
            <span style={{ color: PRIMARY, fontSize: 'clamp(30px,3.6vw,44px)' }}>Familia</span>
            <span style={{ color: CORAL, fontSize: 'clamp(30px,3.6vw,44px)' }}>Cerca</span>
          </p>
          <p style={{ fontSize: 'clamp(18px,2vw,22px)', color: '#6B7280', lineHeight: 1.8, margin: 0, fontFamily: SANS, fontWeight: 300 }}>
            Un sistema que convierte el cuidado familiar en algo claro, coordinado y en tiempo real. Cada persona sabe qué pasó. Cada acción queda registrada. Toda la familia ve lo mismo.
          </p>
        </div>
      </section>

      {/* ─────────────── 6. BENEFITS ─────────────── */}
      <section style={{ background: SAND, padding: '96px 32px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,56px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: 0 }}>
              ¿Qué cambia para tu familia?
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { icon: '🧘', title: 'Tranquilidad', desc: 'Todos saben exactamente cómo está tu familiar.' },
              { icon: '👨‍👩‍👧‍👦', title: 'Coordinación real', desc: 'Familiares y cuidadores trabajan como un solo equipo.' },
              { icon: '📋', title: 'Historial completo', desc: 'Nada se pierde entre mensajes o llamadas.' },
              { icon: '🚨', title: 'Respuesta rápida', desc: 'Alertas automáticas cuando algo requiere atención.' },
            ].map((b, i) => (
              <div key={b.title} className={`reveal reveal-delay-${i}`} style={{ background: WHITE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: '36px 28px', boxShadow: '0 4px 20px rgba(13,107,99,0.06)' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{b.icon}</div>
                <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 10px', lineHeight: 1.2 }}>{b.title}</h3>
                <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── 7. FEATURES ─────────────── */}
      <section id="funciones" style={{ padding: '128px 32px', background: CREAM, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(13,107,99,0.05) 0%, transparent 70%)' }} />
        <div style={{ maxWidth: 1140, margin: '0 auto', position: 'relative' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Funciones</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,60px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: '0 0 20px' }}>
              Todo lo que necesitas en un solo lugar
            </h2>
            <p style={{ fontSize: 18, color: '#6B7280', lineHeight: 1.78, maxWidth: 540, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
              FamiliaCerca coordina a toda la familia para que ningún detalle del cuidado quede sin atender.
            </p>
          </div>

          {/* 3 large hero cards */}
          <div className="feature-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 24 }}>

            {/* Card 1: Medicamentos */}
            <div className="feature-hero-card reveal" style={{ background: WHITE, borderRadius: 22, border: `1px solid rgba(13,107,99,0.18)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(13,107,99,0.07)', minHeight: 420, position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: `rgba(20,60,50,0.07)`, border: '1px solid rgba(20,60,50,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 18 }}>📊</div>
              <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(233,130,110,0.30)`, marginBottom: 12, background: 'rgba(233,130,110,0.07)' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: GOLD, letterSpacing: '0.08em', fontFamily: SANS }}>Lo más importante</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 10px', lineHeight: 1.2 }}>Estado del paciente en tiempo real</h3>
              <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                Lo primero que todos quieren saber. Estado actual, medicamentos pendientes, última actualización y quién la realizó.
              </p>
              <div style={{ background: SAND, borderRadius: 12, padding: '12px 14px', border: `1px solid rgba(13,107,99,0.10)` }}>
                {[
                  { label: 'Atenolol 25mg · 8am', done: true, alert: false },
                  { label: 'Metformina 500mg · 1pm', done: true, alert: false },
                  { label: 'Losartán 50mg · 8pm', done: false, alert: true },
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid rgba(13,107,99,0.08)` : 'none' }}>
                    <span style={{ width: 17, height: 17, borderRadius: '50%', background: item.done ? ACTION : 'transparent', border: `1.5px solid ${item.done ? ACTION : item.alert ? CORAL : 'rgba(13,107,99,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.done && <span style={{ color: WHITE, fontSize: 8 }}>✓</span>}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: SANS, color: item.done ? '#9BA89F' : item.alert ? CORAL : PRIMARY, textDecoration: item.done ? 'line-through' : 'none', fontWeight: item.alert ? 500 : 300 }}>{item.label}</span>
                    {item.alert && <span style={{ fontSize: 9, color: CORAL, marginLeft: 'auto', fontFamily: SANS, fontWeight: 600 }}>⚠ PENDIENTE</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Chat categorizado */}
            <div className="feature-hero-card reveal reveal-delay-1" style={{ background: WHITE, borderRadius: 22, border: `1px solid rgba(13,107,99,0.18)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(13,107,99,0.07)', minHeight: 420, position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: `rgba(20,60,50,0.07)`, border: '1px solid rgba(20,60,50,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 18 }}>💬</div>
              <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(233,130,110,0.30)`, marginBottom: 12, background: 'rgba(233,130,110,0.07)' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: GOLD, letterSpacing: '0.08em', fontFamily: SANS }}>Sin mensajes perdidos</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 10px', lineHeight: 1.2 }}>Chat familiar organizado</h3>
              <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                Cada conversación en su categoría — medicamentos, citas, urgencias — para que nada se pierda entre mensajes.
              </p>
              <div style={{ background: SAND, borderRadius: 12, padding: '12px', border: `1px solid rgba(13,107,99,0.10)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { from: 'María', msg: '🏥 Cita con cardiólogo mañana 3pm', mine: false, tag: '#médico' },
                  { from: 'Yo', msg: '✅ Ya le di el Atenolol, está bien', mine: true, tag: '#medicamentos' },
                  { from: 'Carlos', msg: '🚨 Llamó diciendo que se siente mal', mine: false, tag: '#urgente' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '7px 11px', borderRadius: 11, background: b.mine ? ACTION : WHITE, border: b.mine ? 'none' : `1px solid rgba(13,107,99,0.14)` }}>
                      {!b.mine && <p style={{ margin: '0 0 2px', fontSize: 9, color: GOLD, fontFamily: SANS, fontWeight: 600 }}>{b.from}</p>}
                      <p style={{ margin: 0, fontSize: 11, color: b.mine ? WHITE : PRIMARY, fontFamily: SANS, lineHeight: 1.4 }}>{b.msg}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 8, color: b.mine ? 'rgba(255,255,255,0.50)' : ACTION, fontFamily: SANS }}>{b.tag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Registros médicos + PDF */}
            <div className="feature-hero-card feature-hero-card--span reveal reveal-delay-2" style={{ background: WHITE, borderRadius: 22, border: `1px solid rgba(13,107,99,0.18)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(13,107,99,0.07)', minHeight: 420, position: 'relative' }}>
              <div className="feature-hero-span-content">
                <div className="feature-hero-span-text">
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: `rgba(20,60,50,0.07)`, border: '1px solid rgba(20,60,50,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 18 }}>📋</div>
                  <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(233,130,110,0.30)`, marginBottom: 12, background: 'rgba(233,130,110,0.07)' }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: GOLD, letterSpacing: '0.08em', fontFamily: SANS }}>Listo para el doctor</span>
                  </div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 10px', lineHeight: 1.2 }}>Historial médico y exportación</h3>
                  <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                    Visitas, incidentes y análisis organizados, exportables en PDF para cualquier consulta.
                  </p>
                </div>
                <div className="feature-hero-span-mockup" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '🏥', label: 'Visita cardiólogo', date: '28 may', color: `rgba(20,60,50,0.07)` },
                    { icon: '⚠️', label: 'Incidente: caída leve', date: '25 may', color: 'rgba(233,130,110,0.07)' },
                    { icon: '💉', label: 'Análisis de sangre', date: '20 may', color: `rgba(20,60,50,0.07)` },
                    { icon: '📄', label: 'Exportar a PDF →', date: '', color: `rgba(233,130,110,0.09)`, action: true },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: item.color, borderRadius: 10, border: `1px solid rgba(13,107,99,0.08)` }}>
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, fontFamily: SANS, color: item.action ? GOLD : PRIMARY, fontWeight: item.action ? 600 : 300, flex: 1 }}>{item.label}</span>
                      {item.date && <span style={{ fontSize: 10, color: '#6B7280', fontFamily: SANS }}>{item.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3 small secondary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {[
              { icon: '🎙️', title: 'Álbum de recuerdos y notas de voz', desc: 'Fotos y notas de voz que construyen la memoria de tu familiar.' },
              { icon: '🆘', title: 'Botón SOS', desc: 'Un toque y todos reciben la alerta al instante.' },
              { icon: '🗓️', title: 'Rutinas y citas médicas', desc: 'Checklist diario y citas con recordatorio automático.' },
            ].map((f, i) => (
              <div key={f.title} className={`reveal reveal-delay-${i}`} style={{ background: WHITE, borderRadius: 16, border: `1px solid rgba(13,107,99,0.16)`, padding: '26px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', boxShadow: '0 2px 12px rgba(13,107,99,0.05)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: `rgba(20,60,50,0.07)`, border: `1px solid rgba(20,60,50,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 6px' }}>{f.title}</h3>
                  <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── 7.2. MILO & LUNA ─────────────── */}
      <section style={{ background: PRIMARY, padding: '128px 32px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto' }}>
            <img src={MILO_LUNA_IMG} alt="Milo y Luna, compañeros con inteligencia artificial de FamiliaCerca" style={{ width: 220, borderRadius: 20, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,0.30)' }} />
          </div>
          <div style={{ flex: '1 1 420px', maxWidth: 560, textAlign: 'center' }} className="reveal">
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,52px)', fontWeight: 600, color: CREAM, lineHeight: 1.15, margin: '0 0 20px' }}>
              Tu familia nunca está sola
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(248,244,237,0.72)', lineHeight: 1.8, margin: 0, fontFamily: SANS, fontWeight: 300 }}>
              Milo y Luna, los compañeros con inteligencia artificial de FamiliaCerca, ayudan a detectar cambios, recordar información y acompañar el cuidado — día y noche.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────── 7.5. CREDIBILIDAD ─────────────── */}
      <section style={{ background: '#FBEAE4', padding: '96px 32px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* Slot ampliable con testimonios reales de familias */}
          <div style={{ fontFamily: SERIF, fontSize: 90, color: PRIMARY, lineHeight: 0.7, marginBottom: 12, opacity: 0.18 }}>"</div>
          <blockquote className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(24px,3vw,38px)', fontWeight: 500, color: PRIMARY, lineHeight: 1.45, margin: '0 0 28px' }}>
            Antes era imposible coordinarnos. Ahora todos sabemos qué está pasando sin preguntar.
          </blockquote>
          <p className="reveal reveal-delay-1" style={{ fontSize: 15, color: 'rgba(20,60,50,0.62)', fontFamily: SANS, fontWeight: 400, lineHeight: 1.65, maxWidth: 460, margin: 0 }}>
            — Ysabelle, fundadora de FamiliaCerca. Creó la app después de años coordinando el cuidado de su familia por WhatsApp.
          </p>
        </div>
      </section>

      {/* ─────────────── 8. WHATSAPP COMPARISON (de esto a esto) ─────────────── */}
      <section style={{ background: CREAM, padding: '120px 32px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>El caos conocido</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,56px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: '0 0 18px' }}>
              WhatsApp es para conversar. FamiliaCerca es para cuidar.
            </h2>
            <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.75, maxWidth: 520, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
              Cuando una persona depende de varios familiares o cuidadores, los mensajes se pierden, las tareas se duplican y la información desaparece. FamiliaCerca mantiene todo organizado en un solo lugar.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }} className="whatsapp-comparison-grid">

            {/* WhatsApp: chaos panel — authentic WhatsApp colors intentional for contrast */}
            <div className="reveal" style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ background: '#075E54', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#128C7E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👨‍👩‍👧</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: SANS }}>
                    <span style={{ color: '#25D366' }}>WhatsApp</span> — Familia
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: SANS }}>8 participantes · 247 mensajes sin leer</p>
                </div>
                <div style={{ marginLeft: 'auto', background: '#25D366', borderRadius: 9999, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: WHITE, fontSize: 10, fontWeight: 700 }}>247</span>
                </div>
              </div>
              <div style={{ background: '#E5DDD5', padding: '14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 380 }}>
                {[
                  { from: 'Mamá 📱', msg: '¿alguien le dio el medicamento a papá??', mine: false, time: '9:14' },
                  { from: 'Jorge', msg: 'yo no sé, pensé que tú lo hacías 🤷', mine: false, time: '9:15' },
                  { from: 'Tía Rosa', msg: 'esperen estoy buscando el mensaje de ayer', mine: false, time: '9:16' },
                  { from: 'Mamá 📱', msg: 'AQUÍ DICE QUE SÍ SE LO DIERON pero no estoy segura', mine: false, time: '9:17' },
                  { from: 'Yo', msg: 'no encuentro nada, hay 200 mensajes', mine: true, time: '9:18' },
                  { from: 'Tía Rosa', msg: '😰 mejor daselo de nuevo?', mine: false, time: '9:19' },
                  { from: 'Jorge', msg: 'NO no se puede dar doble dosis!! 🚫', mine: false, time: '9:19' },
                  { from: 'Mamá 📱', msg: 'ay dios mío qué hacemos', mine: false, time: '9:20' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: b.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: b.mine ? '#DCF8C6' : WHITE, position: 'relative' }}>
                      {!b.mine && <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#128C7E', fontFamily: SANS }}>{b.from}</p>}
                      <p style={{ margin: 0, fontSize: 12, color: '#303030', fontFamily: SANS, lineHeight: 1.4 }}>{b.msg}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 9, color: '#9CA3AF', fontFamily: SANS, textAlign: 'right' }}>{b.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#F0F0F0', padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, color: CORAL, fontFamily: SANS, fontWeight: 500 }}>✕ Sin registro · Sin confirmación · Sin claridad</p>
              </div>
            </div>

            {/* FamiliaCerca: calm panel */}
            <div className="reveal reveal-delay-1" style={{ borderRadius: 24, overflow: 'hidden', boxShadow: `0 12px 48px rgba(20,60,50,0.14)`, border: `2px solid ${ACTION}` }}>
              <div style={{ background: PRIMARY, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/icon-192.png" alt="FC" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: SANS }}>FamiliaCerca</p>
                  <p style={{ margin: 0, fontSize: 11, color: MINT_C, fontFamily: SANS }}>Medicamentos · Todo en orden</p>
                </div>
                <div style={{ marginLeft: 'auto', background: 'rgba(235,246,238,0.18)', borderRadius: 9999, padding: '4px 12px' }}>
                  <span style={{ color: MINT_C, fontSize: 11, fontWeight: 600 }}>✓ Al día</span>
                </div>
              </div>
              <div style={{ background: SAND, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 380 }}>
                {/* Confirmed med card */}
                <div style={{ background: WHITE, borderRadius: 14, padding: '14px 16px', border: `1px solid rgba(13,107,99,0.15)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: PRIMARY, fontFamily: SANS }}>💊 Medicamentos del día</p>
                    <span style={{ fontSize: 10, color: ACTION, background: MINT_C, borderRadius: 9999, padding: '2px 10px', fontFamily: SANS, fontWeight: 600 }}>2/3 ✓</span>
                  </div>
                  {[
                    { med: 'Atenolol 25mg · 8am', who: 'Jorge', done: true },
                    { med: 'Metformina · 1pm', who: 'Tía Rosa', done: true },
                    { med: 'Losartán · 8pm', who: 'Pendiente', done: false },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.done ? ACTION : 'transparent', border: `1.5px solid ${item.done ? ACTION : 'rgba(0,0,0,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.done && <span style={{ color: WHITE, fontSize: 7 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 11, fontFamily: SANS, color: item.done ? '#6B7280' : PRIMARY, textDecoration: item.done ? 'line-through' : 'none', flex: 1 }}>{item.med}</span>
                      <span style={{ fontSize: 9, color: item.done ? ACTION : CORAL, fontFamily: SANS, fontWeight: 500 }}>{item.who}</span>
                    </div>
                  ))}
                </div>
                {/* Confirmation with photo */}
                <div style={{ background: WHITE, borderRadius: 14, padding: '12px 16px', border: `1px solid rgba(13,107,99,0.15)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: MINT_C, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📷</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: PRIMARY, fontFamily: SANS }}>Jorge confirmó con foto</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#6B7280', fontFamily: SANS }}>Atenolol 25mg · hoy 8:03 AM · ✓ Verificado</p>
                    </div>
                  </div>
                </div>
                {/* Alert card */}
                <div style={{ background: 'rgba(233,130,110,0.07)', borderRadius: 14, padding: '12px 16px', border: `1px solid rgba(233,130,110,0.22)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: CORAL, fontFamily: SANS }}>Alerta: Losartán pendiente a las 8pm</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#6B7280', fontFamily: SANS }}>Notificado a 3 cuidadores · Ventana ±1 hora</p>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: MINT_C, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, color: PRIMARY, fontFamily: SANS, fontWeight: 600 }}>✓ Registro claro · Foto de prueba · Todos informados</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ─────────────── 9. HOW IT WORKS ─────────────── */}
      <section id="como" style={{ padding: '128px 32px', background: SAND }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 88, flexWrap: 'wrap' }} className="como-grid">
          <div style={{ flex: '1 1 360px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 18px', fontFamily: SANS }}>Cómo funciona</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,56px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.12, margin: '0 0 52px' }}>
              Listo en 3 minutos. Diseñado para acompañarte todos los días.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div className="como-line" style={{ position: 'absolute', left: 39, top: 64, bottom: 64, width: 2, background: `linear-gradient(to bottom, ${ACTION}, rgba(13,107,99,0.08))` }} />
              {[
                { n: '1', title: 'Crea tu cuenta gratis', desc: 'Sin tarjeta de crédito, sin descarga en tienda de apps.' },
                { n: '2', title: 'Agrega a tu familiar y los cuidadores', desc: 'Cada uno con su propio acceso y rol.' },
                { n: '3', title: 'Configura medicamentos y rutinas', desc: 'La app recuerda a cada cuidador qué toca y cuándo.' },
                { n: '4', title: 'Coordínense en tiempo real', desc: 'Cada confirmación y alerta llega a todos al instante. Nunca más: ¿ya le diste la pastilla?' },
              ].map((s, i, arr) => (
                <div key={s.n} className={`reveal reveal-delay-${i}`} style={{ display: 'flex', gap: 24, marginBottom: i < arr.length - 1 ? 32 : 0 }}>
                  <div style={{ flexShrink: 0, zIndex: 1 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${ACTION} 0%, #143C32 100%)`, color: WHITE, fontWeight: 700, fontSize: 28, fontFamily: SERIF, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(13,107,99,0.28)' }}>{s.n}</div>
                  </div>
                  <div style={{ paddingTop: 22 }}>
                    <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: PRIMARY, margin: '0 0 8px' }}>{s.title}</h3>
                    <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.78, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 52 }}>
              <CTABtn to="/register">Empezar gratis</CTABtn>
            </div>
          </div>
          <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }} className="como-img">
            <img src={COMO_IMG} alt="Cómo funciona FamiliaCerca" style={{ width: '100%', borderRadius: 24, boxShadow: `0 16px 64px rgba(13,107,99,0.16)`, border: `1px solid rgba(13,107,99,0.10)` }} />
          </div>
        </div>
      </section>

      {/* ─────────────── 9.5. PARA QUIÉN ES ─────────────── */}
      <section style={{ background: CREAM, padding: '112px 32px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,52px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.15, margin: 0 }}>
              FamiliaCerca es para ti si…
            </h2>
          </div>
          <div className="para-quien-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
            {[
              {
                text: 'Eres el cuidador principal y cargas con todo',
                icon: <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7" /></svg>,
              },
              {
                text: 'Tu familia está repartida en distintas ciudades o países',
                icon: <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>,
              },
              {
                text: 'Cuidas a tus padres o abuelos',
                icon: <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>,
              },
              {
                text: 'Tu familiar vive con una condición crónica',
                icon: <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>,
              },
            ].map((item, i) => (
              <div key={item.text} className={`para-quien-card reveal reveal-delay-${i % 3}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18, background: '#FBEAE4', borderRadius: 16, padding: 'clamp(28px,3vw,36px) 20px' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: i < 2 ? ACTION : CORAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                <p style={{ fontSize: 16, color: PRIMARY, lineHeight: 1.5, margin: 0, fontFamily: SANS, fontWeight: 500 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── 10. MARQUEE 2 ─────────────── */}
      <section style={{ background: DARK, padding: '20px 0', overflow: 'hidden', borderTop: `1px solid rgba(233,130,110,0.08)`, borderBottom: `1px solid rgba(233,130,110,0.08)` }}>
        <div className="marquee-container">
          <div className="marquee-track marquee-track-reverse">
            {[...marqueeFeatures, ...marqueeFeatures].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 32px', whiteSpace: 'nowrap', fontSize: 14, color: GOLD, fontFamily: SANS, fontWeight: 400 }}>
                {item}
                <span style={{ color: `rgba(233,130,110,0.28)`, fontSize: 18, lineHeight: 1 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── EMOTIONAL QUOTE ─────────────── */}
      <section style={{ padding: '128px 32px', background: DARK }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: GOLD, lineHeight: 0.7, marginBottom: 20, opacity: 0.28 }}>"</div>
          <blockquote className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(28px,3.8vw,54px)', fontWeight: 500, color: GOLD, lineHeight: 1.45, margin: '0 0 40px' }}>
            Un día vas a querer volver a este momento. FamiliaCerca lo guarda por ti.
          </blockquote>
          <CTABtn to="/register">
            Empezar gratis <span style={{ fontSize: 17, opacity: 0.8 }}>→</span>
          </CTABtn>
        </div>
      </section>

      {/* ─────────────── 11. TESTIMONIOS ─────────────── */}
      <section style={{ padding: '128px 32px', background: CREAM }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Testimonios</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,60px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: 0 }}>
              Familias que cuidan mejor juntas
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="testimonios-grid">
            {(showAllTestimonials ? testimonials : testimonials.slice(0, 3)).map((t, i) => (
              <div key={t.name} className={i >= 3 ? 'testimonios-expand' : `reveal reveal-delay-${i % 3}`} style={{ background: PRIMARY, borderRadius: 20, border: `1px solid rgba(13,107,99,0.28)`, padding: '32px 28px', boxShadow: '0 12px 32px rgba(20,60,50,0.12)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ color: CORAL, fontSize: 13 }}>★</span>)}
                </div>
                <p style={{ fontSize: 17, fontWeight: 600, color: WHITE, fontFamily: SERIF, margin: '0 0 12px', lineHeight: 1.3 }}>{t.headline}</p>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, margin: '0 0 24px', fontFamily: SANS, fontWeight: 300, fontStyle: 'italic', flex: 1 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: ACTION, border: `1px solid rgba(13,107,99,0.60)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: WHITE }}>{t.initial}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: WHITE, fontFamily: SANS }}>{t.name}</p>
                    <p style={{ margin: '2px 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.38)', fontFamily: SANS, fontWeight: 300 }}>{t.role}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `rgba(233,130,110,0.10)`, borderRadius: 9999, padding: '2px 10px' }}>
                      <span style={{ fontSize: 10 }}>📍</span>
                      <span style={{ fontSize: 12, color: GOLD, fontFamily: SANS, fontWeight: 300 }}>{t.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <button onClick={() => setShowAllTestimonials(v => !v)} style={{ padding: '14px 32px', borderRadius: 9999, border: `1.5px solid ${ACTION}`, background: 'transparent', color: ACTION, fontWeight: 500, fontSize: 15, fontFamily: SANS, cursor: 'pointer', letterSpacing: '0.02em' }}>
              {showAllTestimonials ? 'Ver menos historias' : 'Ver más historias'}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────── EMOTIONAL QUOTE 2 ─────────────── */}
      <section style={{ padding: '128px 32px', background: '#143C32' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: GOLD, lineHeight: 0.7, marginBottom: 20, opacity: 0.22 }}>"</div>
          <blockquote className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(28px,3.8vw,54px)', fontWeight: 500, color: CREAM, lineHeight: 1.45, margin: '0 0 36px' }}>
            No tienes que cargar con todo en la memoria. FamiliaCerca recuerda por ti.
          </blockquote>
          <p className="reveal reveal-delay-1" style={{ fontSize: 18, color: 'rgba(245,240,232,0.62)', lineHeight: 1.80, maxWidth: 640, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
            Los medicamentos importan. Las citas importan. Las rutinas importan. Pero los recuerdos también. Cada actualización construye la historia de cuidado de la persona que amas.
          </p>
        </div>
      </section>

      {/* ─────────────── 12. PRECIOS ─────────────── */}
      <section id="precios" style={{ padding: '128px 32px', background: CREAM }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Precios</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,60px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: '0 0 16px' }}>Simple y transparente</h2>
            <p style={{ fontSize: 18, color: '#6B7280', lineHeight: 1.75, maxWidth: 460, margin: '0 auto 36px', fontFamily: SANS, fontWeight: 300 }}>
              Empieza gratis, actualiza cuando lo necesites. Sin contratos ni sorpresas.
            </p>
            <div style={{ display: 'inline-flex', background: WHITE, borderRadius: 9999, padding: 4, border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <button onClick={() => setAnnual(false)} style={{ padding: '10px 28px', borderRadius: 9999, border: 'none', cursor: 'pointer', background: !annual ? ACTION : 'transparent', color: !annual ? WHITE : '#6B7280', fontSize: 14, fontFamily: SANS, fontWeight: 500, transition: 'background 0.2s, color 0.2s' }}>Mensual</button>
              <button onClick={() => setAnnual(true)} style={{ padding: '10px 28px', borderRadius: 9999, border: 'none', cursor: 'pointer', background: annual ? ACTION : 'transparent', color: annual ? WHITE : '#6B7280', fontSize: 14, fontFamily: SANS, fontWeight: 500, transition: 'background 0.2s, color 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}>
                Anual
                <span style={{ background: MINT_C, color: PRIMARY, fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>-20%</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
            {plans.map(p => <PriceCard key={p.name} {...p} annual={annual} onTrack={track} />)}
          </div>
          <div className="reveal" style={{ textAlign: 'center', marginTop: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: WHITE, borderRadius: 18, padding: '18px 30px', border: `1px solid ${BORDER}`, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <span style={{ fontSize: 26 }}>🛡️</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: DARK, fontFamily: SANS }}>Prueba 14 días gratis — sin tarjeta de crédito</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── 13. PWA ─────────────── */}
      <section style={{ padding: '128px 32px', background: PRIMARY }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 72, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 18px', fontFamily: SANS }}>Sin App Store</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,56px)', fontWeight: 600, color: WHITE, lineHeight: 1.12, margin: '0 0 18px' }}>
              Agrégala a tu celular en segundos
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.62)', lineHeight: 1.80, margin: '0 0 40px', fontFamily: SANS, fontWeight: 300 }}>
              Sin pasar por la App Store ni Google Play — funciona como una app nativa directo desde tu navegador.
            </p>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.10)', borderRadius: 9999, padding: 4, marginBottom: 28, width: 'fit-content' }}>
              {[{ id: 'iphone', label: '🍎 iPhone' }, { id: 'android', label: '🤖 Android' }].map(tab => (
                <button key={tab.id} onClick={() => setPwaTab(tab.id)} style={{ padding: '8px 20px', borderRadius: 9999, border: 'none', background: pwaTab === tab.id ? WHITE : 'transparent', color: pwaTab === tab.id ? ACTION : 'rgba(255,255,255,0.60)', fontWeight: pwaTab === tab.id ? 700 : 400, fontSize: 13, fontFamily: SANS, cursor: 'pointer', transition: 'all 0.18s' }}>
                  {tab.label}
                </button>
              ))}
            </div>
            {(pwaTab === 'iphone' ? [
              { n: '1', text: 'Abre esta página en Safari (no Chrome)' },
              { n: '2', text: 'Toca el botón Compartir ↑ en la barra inferior' },
              { n: '3', text: 'Desliza y toca "Agregar a pantalla de inicio" → Agregar' },
            ] : [
              { n: '1', text: 'Abre esta página en Chrome' },
              { n: '2', text: 'Toca los 3 puntos ⋮ en la esquina superior derecha' },
              { n: '3', text: 'Toca "Instalar aplicación" → ¡Listo!' },
            ]).map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '1.5px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: WHITE, flexShrink: 0 }}>{s.n}</div>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', fontFamily: SANS, fontWeight: 300, paddingTop: 8, margin: 0 }}>{s.text}</p>
              </div>
            ))}
            {installed ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 22px', borderRadius: 9999, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.30)', marginTop: 8 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: SANS }}>¡App ya instalada!</span>
              </div>
            ) : (pwaTab === 'android' && canPrompt) ? (
              <button onClick={async () => { const outcome = await install(); if (outcome === 'accepted') setPwaInstallClicked(true) }} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '15px 32px', borderRadius: 9999, border: 'none', background: WHITE, color: ACTION, fontWeight: 700, fontSize: 15, fontFamily: SANS, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 8px 32px rgba(0,0,0,0.20)' }}>
                {pwaInstallClicked ? '¡Instalando! 🎉' : '📲 Instalar ahora'}
              </button>
            ) : null}
          </div>
          {/* Phone mockup */}
          <div style={{ flex: '0 0 280px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 260, height: 520, background: '#1A1A1A', borderRadius: 40, padding: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.50)', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 56, height: 18, background: '#1A1A1A', borderRadius: '0 0 12px 12px', zIndex: 2 }} />
              <div style={{ width: '100%', height: '100%', borderRadius: 32, background: 'linear-gradient(160deg, #1C1C2E 0%, #0F0F1A 100%)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 16px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: SANS }}>9:41</p>
                <p style={{ margin: '0 0 24px', fontSize: 9, color: 'rgba(255,255,255,0.18)', fontFamily: SANS }}>sábado, 23 mayo</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 20px rgba(13,107,99,0.50)', flexShrink: 0 }}>
                      <img src="/icon-192.png" alt="FamiliaCerca" style={{ width: 44, height: 44, display: 'block' }} />
                    </div>
                    <span style={{ fontSize: 8, color: WHITE, fontFamily: SANS, textAlign: 'center', lineHeight: 1.2 }}>Familia Cerca</span>
                  </div>
                  {[['📞','Tel.'],['💬','Msgs'],['📷','Cam'],['🗓️','Cal.'],['📧','Mail'],['🗺️','Maps'],['⚙️','Aj.']].map(([em, label]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{em}</div>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.40)', fontFamily: SANS }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '8px 12px' }}>
                  {['📞','💬','🌐','📷'].map((em, i) => (
                    <div key={i} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{em}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── 14. FAQ ─────────────── */}
      <section id="faq" style={{ padding: '128px 32px', background: CREAM }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: ACTION, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Preguntas frecuentes</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,60px)', fontWeight: 600, color: PRIMARY, lineHeight: 1.1, margin: 0 }}>
              Todo lo que necesitas saber
            </h2>
          </div>
          {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} light onTrack={track} />)}
        </div>
      </section>

      {/* ─────────────── 15. CTA FINAL ─────────────── */}
      <section style={{ position: 'relative', padding: '160px 32px', overflow: 'hidden', minHeight: 560, display: 'flex', alignItems: 'center' }}>
        <img src={CTA_IMG} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,60,50,0.88)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(20,60,50,0.65) 0%, transparent 55%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', width: '100%' }}>
          <div style={{ maxWidth: 680 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>Empieza hoy</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(44px,6vw,84px)', fontWeight: 700, color: WHITE, lineHeight: 1.02, margin: '0 0 24px' }}>
              Empieza a cuidar mejor, juntos.
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.62)', lineHeight: 1.80, margin: '0 0 48px', fontFamily: SANS, fontWeight: 300 }}>
              Deja atrás el caos de WhatsApp. En 3 minutos tu familia tiene un solo lugar para coordinar el cuidado — gratis, sin tarjeta.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <Link to="/register" style={{ padding: '20px 52px', borderRadius: 9999, background: WHITE, color: ACTION, fontWeight: 500, fontSize: 18, textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em', boxShadow: '0 16px 56px rgba(0,0,0,0.28)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                Empezar gratis →
              </Link>
              <a href="#funciones" style={{ padding: '20px 36px', borderRadius: 9999, border: '1.5px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.78)', fontWeight: 400, fontSize: 15, textDecoration: 'none', fontFamily: SANS, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11 }}>▶</span> Ver funciones
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── 16. FOOTER ─────────────── */}
      <footer style={{ background: '#F8F4ED', padding: '64px 32px 48px', borderTop: `1px solid rgba(20,60,50,0.08)` }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 48, marginBottom: 52 }}>
            <div style={{ flex: '0 0 auto', maxWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '4px 0' }}>
                <img src="/logo.png" alt="FamiliaCerca" style={{ width: 44, height: 44, objectFit: 'contain', display: 'block' }} />
                <span style={{ fontFamily: SERIF, fontWeight: 700, margin: 0, padding: 0 }}>
                  <span style={{ color: '#143C32', fontSize: 26 }}>Familia</span>
                  <span style={{ color: '#E9826E', fontSize: 26 }}>Cerca</span>
                </span>
              </div>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, fontFamily: SANS, fontWeight: 300, margin: '0 0 24px' }}>
                Cuidado familiar coordinado para la comunidad hispana. Medicamentos, rutinas y amor — todo en un solo lugar.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Instagram', href: 'https://www.instagram.com/familia.cerca/', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> },
                  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61589584865936', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg> },
                  { label: 'WhatsApp', href: 'https://wa.me/?text=Te%20comparto%20FamiliaCerca%2C%20una%20app%20para%20coordinar%20el%20cuidado%20familiar%20%F0%9F%92%9A%20familiacerca.com', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z"/></svg> },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,60,50,0.06)', border: '1px solid rgba(20,60,50,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.color = GOLD; e.currentTarget.style.background = `rgba(233,130,110,0.10)` }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'rgba(20,60,50,0.06)' }}
                  >{s.icon}</a>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#143C32', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Contacto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'hola@familiacerca.com', href: 'mailto:hola@familiacerca.com' },
                    { label: '@familia.cerca', href: 'https://www.instagram.com/familia.cerca/' },
                  ].map(l => (
                    <a key={l.href} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      style={{ fontSize: 15, color: '#6B7280', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#143C32'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                    >{l.label}</a>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#143C32', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Producto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{label:'Funciones',href:'#funciones'},{label:'Precios',href:'#precios'},{label:'Cómo funciona',href:'#como'},{label:'Preguntas',href:'#faq'}].map(l => (
                    <a key={l.href} href={l.href} style={{ fontSize: 15, color: '#6B7280', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#143C32'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                    >{l.label}</a>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#143C32', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Legal</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{label:'Términos de uso',to:'/terminos'},{label:'Privacidad',to:'/privacidad'},{label:'Iniciar sesión',to:'/login'},{label:'Crear cuenta',to:'/register'}].map(l => (
                    <Link key={l.label} to={l.to} style={{ fontSize: 15, color: '#6B7280', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#143C32'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                    >{l.label}</Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(20,60,50,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, fontFamily: SANS, fontWeight: 300 }}>© {new Date().getFullYear()} FamiliaCerca. Todos los derechos reservados.</p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, fontFamily: SANS, fontWeight: 300 }}>Hecho con ❤️ para familias hispanohablantes</p>
          </div>
        </div>
      </footer>

      <InstallBanner />

      {/* ─────────────── 17. STICKY BAR ─────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9000, background: ACTION, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, boxShadow: '0 -4px 24px rgba(0,0,0,0.22)', opacity: showBar && !dismissed ? 1 : 0, transform: showBar && !dismissed ? 'translateY(0)' : 'translateY(100%)', transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)', pointerEvents: showBar && !dismissed ? 'all' : 'none' }}>
        {canPrompt && !installed ? (
          <button
            onClick={async () => {
              track('sticky_bar_click', { action: 'install_prompt' })
              const outcome = await install()
              if (outcome === 'accepted') setDismissed(true)
            }}
            style={{ color: WHITE, fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(14px, 2vw, 16px)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, letterSpacing: '0.01em' }}
          >
            📲 Instalar FamiliaCerca — es gratis
            <span style={{ fontSize: 18, opacity: 0.85 }}>→</span>
          </button>
        ) : (
          <Link to="/register" onClick={() => track('sticky_bar_click', { action: 'register' })} style={{ color: WHITE, fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(14px, 2vw, 16px)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, letterSpacing: '0.01em' }}>
            Instalar FamiliaCerca — es gratis
            <span style={{ fontSize: 18, opacity: 0.85 }}>→</span>
          </Link>
        )}
        <button
          onClick={() => { setDismissed(true); track('sticky_bar_click', { action: 'dismiss' }) }}
          aria-label="Cerrar"
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 14, lineHeight: 1 }}
        >×</button>
      </div>

      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1); }
        .reveal.in-view { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.12s; }
        .reveal-delay-2 { transition-delay: 0.24s; }
        .reveal-delay-3 { transition-delay: 0.36s; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        .hero-reveal { animation: fadeInUp 0.78s cubic-bezier(0.16,1,0.3,1) both; }
        .hero-delay-1 { animation-delay: 0.05s; }
        .hero-delay-2 { animation-delay: 0.18s; }
        .hero-delay-3 { animation-delay: 0.34s; }
        .hero-delay-4 { animation-delay: 0.50s; }
        .hero-delay-5 { animation-delay: 0.64s; }

        @keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes marquee-scroll-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .marquee-container { overflow: hidden; }
        .marquee-track { display: flex; width: max-content; animation: marquee-scroll 52s linear infinite; }
        .marquee-track-reverse { animation: marquee-scroll-reverse 52s linear infinite; }
        .marquee-track:hover, .marquee-track-reverse:hover { animation-play-state: paused; }

        .feature-hero-card { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease; }
        .feature-hero-card:hover { transform: translateY(-8px) !important; box-shadow: 0 28px 80px rgba(13,107,99,0.12) !important; }

        .para-quien-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .para-quien-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(20,60,50,0.12); }

        .testimonios-expand { animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes badge-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(233,130,110,0.55); } 70% { box-shadow: 0 0 0 10px rgba(233,130,110,0); } 100% { box-shadow: 0 0 0 0 rgba(233,130,110,0); } }
        .badge-pulse-anim { animation: badge-pulse-ring 2s cubic-bezier(0.66,0,0,1) infinite; }

        .price-card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .price-card-highlighted { transform: scale(1.04); }
        .price-card-hover:hover { transform: translateY(-5px) scale(1.01) !important; }
        .price-card-highlighted:hover { transform: translateY(-5px) scale(1.05) !important; }

        @keyframes grow-line { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        .como-line { transform-origin: top; animation: grow-line 1s ease-out 0.6s both; }

        .faq-dark-item { transition: background 0.18s ease; border-radius: 8px; }
        .faq-dark-item:hover { background: rgba(233,130,110,0.04); }
        .faq-light-item { transition: background 0.18s ease; border-radius: 8px; }
        .faq-light-item:hover { background: rgba(13,107,99,0.05); }

        .cta-coral { transition: background 0.2s ease !important; }
        .cta-coral:hover { background: #D86F5A !important; }
        .btn-outlined-teal { transition: background 0.2s ease, color 0.2s ease; }
        .btn-outlined-teal:hover { background: #143C32 !important; color: white !important; }
        .btn-nav-cream { transition: background 0.2s ease, color 0.2s ease; }
        .btn-nav-cream:hover { background: #143C32 !important; color: #F8F4ED !important; }

        @media (max-width: 1024px) {
          .para-quien-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .landing-desktop-nav { display: none !important; }
          .landing-hamburger { display: flex !important; }
          .landing-hero-grid { grid-template-columns: 1fr !important; min-height: auto !important; }
          .landing-hero-right { display: none !important; }
          .landing-hero-text { padding: 80px 24px 64px !important; min-height: auto !important; }
          .landing-problema-grid { grid-template-columns: 1fr !important; }
          .landing-problema-img { min-height: 300px !important; }
          .como-grid { flex-direction: column !important; gap: 52px !important; }
          .como-img { display: none !important; }
          .testimonios-grid { grid-template-columns: 1fr !important; }
          .whatsapp-comparison-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
          .stats-grid-cell { border-left: none !important; border-top: 1px solid rgba(13,107,99,0.22); padding: 24px 16px !important; }
          .stats-grid-cell:first-child { border-top: none; }
          .feature-hero-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1040px) and (min-width: 769px) {
          .feature-hero-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .feature-hero-grid > *:last-child { grid-column: span 2; min-height: unset !important; }
          .feature-hero-span-content { display: flex; gap: 32px; align-items: flex-start; }
          .feature-hero-span-text { flex: 1 1 45%; }
          .feature-hero-span-mockup { flex: 1 1 55%; }
        }
        @media (max-width: 640px) {
          .para-quien-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal, .hero-reveal, .marquee-track, .feature-hero-card, .badge-pulse-anim, .como-line {
            animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important;
          }
        }
      `}</style>

      <CompanionChat bottomOffset={24} />
    </div>
  )
}
