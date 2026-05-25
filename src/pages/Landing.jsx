import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePWAInstall } from '../hooks/usePWAInstall'
import PWAInstallBanner from '../components/PWAInstallBanner'

const HERO_IMG = '/images/hero.jpg'
const PROB_IMG = '/images/problema.jpg'
const COMO_IMG = '/images/como.jpg'
const CTA_IMG  = '/images/cta.jpg'

const P  = '#3D6B52'
const PD = '#2E5240'
const AU = '#C4923A'
const SG = '#7BA492'
const DK = '#1E2D26'
const SF = '#F5F0E8'
const SA = '#EDE6D8'
const SW = '#FFFFFF'
const BD = 'rgba(61,107,82,0.10)'

const SERIF = "'Fraunces', 'Cormorant Garamond', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"

const FC_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Ctext x='60' y='65' text-anchor='middle' dominant-baseline='middle' fill='rgba(201%2C136%2C42%2C0.06)' font-size='32' font-family='Georgia%2Cserif' font-weight='700'%3EFC%3C/text%3E%3C/svg%3E")`

const CTABtn = ({ to, children, style = {} }) => (
  <Link to={to} style={{
    display: 'inline-flex', alignItems: 'center', gap: 12,
    padding: '18px 52px', borderRadius: 9999,
    background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
    color: 'white', fontWeight: 500, fontSize: 16,
    textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.025em',
    boxShadow: `0 12px 40px rgba(74,124,89,0.40)`,
    ...style,
  }}>
    {children}
  </Link>
)

function FAQItem({ q, a, light = false }) {
  const [open, setOpen] = useState(false)
  const textColor = light ? '#3A5C45' : 'rgba(255,255,255,0.82)'
  const answerColor = light ? '#6B7E70' : 'rgba(255,255,255,0.50)'
  const borderColor = light ? 'rgba(74,124,89,0.18)' : 'rgba(201,136,42,0.12)'
  const iconBorder = light ? 'rgba(74,124,89,0.35)' : 'rgba(201,136,42,0.40)'
  return (
    <div className={light ? 'faq-light-item' : 'faq-dark-item'} style={{ borderBottom: `1px solid ${borderColor}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '22px 16px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 400, color: textColor, lineHeight: 1.5, paddingRight: 16, fontFamily: SANS }}>
          {q}
        </span>
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `1.5px solid ${iconBorder}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: light ? P : AU, flexShrink: 0,
          transition: 'transform 0.25s ease',
          transform: open ? 'rotate(45deg)' : 'none',
        }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 15, color: answerColor, lineHeight: 1.85, padding: '0 16px 24px', margin: 0, fontFamily: SANS, fontWeight: 300 }}>
          {a}
        </p>
      )}
    </div>
  )
}

function PriceCard({ name, price, period, highlight, badge, features, cta, annual }) {
  const displayPrice = annual && price > 0 ? (price * 0.8).toFixed(2) : price
  return (
    <div
      className={`price-card-hover${highlight ? ' price-card-highlighted' : ''}`}
      style={{
        flex: '1 1 280px', borderRadius: 24,
        background: highlight ? P : 'white',
        padding: '44px 32px',
        boxShadow: highlight ? `0 32px 96px rgba(74,124,89,0.35)` : `0 4px 28px rgba(0,0,0,0.07)`,
        border: highlight ? 'none' : `1px solid ${BD}`,
        position: 'relative', display: 'flex', flexDirection: 'column',
      }}
    >
      {badge && (
        <div className={highlight ? 'badge-pulse-anim' : ''} style={{
          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
          background: AU, color: 'white',
          fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
          padding: '6px 22px', borderRadius: 9999, whiteSpace: 'nowrap', fontFamily: SANS,
        }}>{badge}</div>
      )}
      <p style={{
        fontSize: 10, fontWeight: 500,
        color: highlight ? 'rgba(255,255,255,0.55)' : P,
        textTransform: 'uppercase', letterSpacing: '0.16em',
        margin: '0 0 12px', fontFamily: SANS,
      }}>{name}</p>
      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 52, fontWeight: 700, color: highlight ? 'white' : DK, fontFamily: SERIF, lineHeight: 1 }}>
          {price === 0 ? 'Gratis' : `$${displayPrice}`}
        </span>
        {price > 0 && (
          <span style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF', fontFamily: SANS }}>/mes</span>
        )}
      </div>
      {annual && price > 0 && (
        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.30)' : '#D1D5DB', textDecoration: 'line-through', fontFamily: SANS }}>${price}/mes</span>
          <span style={{ fontSize: 11, background: SG, color: 'white', borderRadius: 4, padding: '2px 8px', fontFamily: SANS, fontWeight: 500 }}>-20%</span>
        </div>
      )}
      <p style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF', margin: '0 0 28px', fontFamily: SANS, fontWeight: 300 }}>
        {annual && price > 0 ? 'facturado anualmente' : period}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, fontFamily: SANS, fontWeight: 300 }}>
            <span style={{ color: f.included ? (highlight ? AU : SG) : (highlight ? 'rgba(255,255,255,0.20)' : '#D1D5DB'), flexShrink: 0, fontWeight: 500 }}>
              {f.included ? '✓' : '–'}
            </span>
            <span style={{ color: f.included ? (highlight ? 'rgba(255,255,255,0.85)' : '#374151') : (highlight ? 'rgba(255,255,255,0.30)' : '#9CA3AF') }}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/login" style={{
        display: 'block', textAlign: 'center', padding: '16px',
        borderRadius: 9999, fontWeight: 500, fontSize: 15,
        textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em',
        background: highlight ? 'white' : 'transparent',
        color: P,
        border: highlight ? 'none' : `1.5px solid ${P}`,
        boxShadow: highlight ? '0 8px 24px rgba(255,255,255,0.18)' : 'none',
      }}>{cta}</Link>
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
  const [counts, setCounts] = useState([0, 0, 0, 0])
  const [showBar, setShowBar] = useState(false)
  const statsRef = useRef(null)

  useEffect(() => {
    if (document.getElementById('landing-gfonts')) return
    const pc1 = document.createElement('link')
    pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com'
    document.head.appendChild(pc1)
    const pc2 = document.createElement('link')
    pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = 'anonymous'
    document.head.appendChild(pc2)
    const lk = document.createElement('link')
    lk.id = 'landing-gfonts'; lk.rel = 'stylesheet'
    lk.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Inter:wght@300;400;500&display=swap'
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
    const el = statsRef.current
    if (!el) return
    const targets = [500, 98, 3, 0]
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      const t0 = Date.now()
      const dur = 1800
      const tick = () => {
        const p = Math.min((Date.now() - t0) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setCounts(targets.map(t => Math.round(t * ease)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 150)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) return null
  if (user) return <Navigate to="/hoy" replace />

  const navLinks = [
    { label: 'Funciones', href: '#funciones' },
    { label: 'Cómo funciona', href: '#como' },
    { label: 'Precios', href: '#precios' },
    { label: 'Preguntas', href: '#faq' },
  ]

  const statItems = [
    { icon: '👨‍👩‍👧', val: `${counts[0]}+`, label: 'familias cuidando' },
    { icon: '💊', val: `${counts[1]}%`, label: 'medicamentos a tiempo' },
    { icon: '⚡', val: `${counts[2]} min`, label: 'para estar listo' },
    { icon: '🔒', val: '0', label: 'contratos ni trampas' },
  ]

  const marqueePain = [
    '✓ Ya no discutimos sobre los medicamentos',
    '✓ Todos ven el historial en tiempo real',
    '✓ Sin más WhatsApp caótico',
    '✓ El doctor ve el registro completo',
    "✓ Nunca más '¿ya le diste la pastilla?'",
    '✓ Coordinamos desde distintas ciudades',
    '✓ Sin App Store, funciona en cualquier celular',
    '✓ Gratis para empezar',
  ]

  const marqueeFeatures = [
    '💊 Control de medicamentos',
    '💬 Chat familiar',
    '🎙️ Álbum de memorias',
    '✅ Checklist diario',
    '🚨 Botón SOS',
    '💰 Gastos de salud',
    '📍 Ubicación en tiempo real',
    '📋 Historial médico',
  ]

  const plans = [
    {
      name: 'Gratis', price: 0, period: 'Para siempre sin costo', highlight: false,
      features: [
        { text: 'Hasta 2 cuidadores', included: true },
        { text: 'Medicamentos ilimitados', included: true },
        { text: 'Checklist de cuidado diario', included: true },
        { text: 'Notas de texto', included: true },
        { text: 'Historial 7 días', included: true },
        { text: 'Foto de prueba', included: false },
        { text: 'Reportes PDF', included: false },
        { text: 'Álbum de memorias', included: false },
      ],
      cta: 'Empezar gratis',
    },
    {
      name: 'Familiar', price: 12.99, period: 'Hasta 6 cuidadores',
      highlight: true, badge: 'Más popular',
      features: [
        { text: 'Hasta 6 cuidadores', included: true },
        { text: 'Medicamentos ilimitados', included: true },
        { text: 'Checklist de cuidado diario', included: true },
        { text: 'Notas de voz y texto', included: true },
        { text: 'Historial completo', included: true },
        { text: 'Foto de prueba de medicamentos', included: true },
        { text: 'Reportes y exportación PDF', included: true },
        { text: 'Álbum de memorias', included: true },
      ],
      cta: 'Comenzar prueba gratis',
    },
    {
      name: 'Cuidado Total', price: 24.99, period: 'Cuidadores ilimitados', highlight: false,
      features: [
        { text: 'Cuidadores ilimitados', included: true },
        { text: 'Todo lo del plan Familiar', included: true },
        { text: 'Directorio médico', included: true },
        { text: 'Control de gastos de salud', included: true },
        { text: 'Alertas SOS prioritarias', included: true },
        { text: 'Soporte prioritario', included: true },
        { text: 'Historial indefinido', included: true },
        { text: 'Acceso anticipado a funciones', included: true },
      ],
      cta: 'Comenzar prueba gratis',
    },
  ]

  const faqs = [
    {
      q: '¿Necesito crear una cuenta para usar FamiliaCerca?',
      a: 'Sí, necesitas una cuenta gratuita para empezar. El registro tarda menos de un minuto — solo tu correo y contraseña. No pedimos tarjeta de crédito para el plan Gratis.',
    },
    {
      q: '¿Cuántas personas pueden usar la misma cuenta familiar?',
      a: 'El plan Gratis permite hasta 2 miembros. El plan Familiar soporta hasta 6 cuidadores y el plan Cuidado Total es ilimitado. Todos ven actualizaciones en tiempo real.',
    },
    {
      q: '¿Funciona sin conexión a internet?',
      a: 'FamiliaCerca es una PWA (app web progresiva). Una vez instalada, muchas funciones como el checklist del día y los medicamentos están disponibles sin conexión. Los cambios se sincronizan cuando vuelve la señal.',
    },
    {
      q: '¿Cómo se instala en el celular si no está en la App Store?',
      a: 'En iPhone: abre la página en Safari, toca el botón de compartir (cuadro con flecha) y selecciona "Agregar a inicio". En Android: toca el menú de tres puntos del navegador y selecciona "Instalar aplicación".',
    },
    {
      q: '¿Mis datos médicos están protegidos?',
      a: 'Sí. Todos los datos se almacenan cifrados en Supabase (infraestructura nivel empresarial). Solo los miembros de tu familia que tú invites tienen acceso. Nunca vendemos ni compartimos información con terceros.',
    },
    {
      q: '¿Puedo cancelar mi suscripción en cualquier momento?',
      a: 'Por supuesto. Puedes cancelar desde Ajustes > Suscripción en cualquier momento. No hay penalizaciones ni contratos. Tu plan baja a Gratis al terminar el período pagado.',
    },
  ]

  return (
    <div style={{ background: 'white', color: DK, overflowX: 'hidden', fontFamily: SANS }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(30,45,38,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(196,146,58,0.12)',
      }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto', padding: '0 32px',
          height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icon-192.png" alt="FamiliaCerca" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
            <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, color: 'white', letterSpacing: '0.01em' }}>
              Familia<span style={{ color: AU }}>Cerca</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="landing-desktop-nav">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontFamily: SANS }}
                onMouseEnter={e => e.currentTarget.style.color = AU}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
              >{l.label}</a>
            ))}
            <Link to="/login" style={{
              padding: '10px 26px', borderRadius: 9999,
              background: `linear-gradient(135deg, ${P}, ${PD})`,
              color: 'white', fontWeight: 500, fontSize: 14,
              textDecoration: 'none', fontFamily: SANS,
              boxShadow: `0 4px 18px rgba(61,107,82,0.35)`,
            }}>Iniciar sesión</Link>
          </div>

          <button onClick={() => setMobileMenuOpen(o => !o)} className="landing-hamburger"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}
            aria-label="Menú">
            {[0,1,2].map(i => <div key={i} style={{ width: 22, height: 1.5, background: 'white', borderRadius: 2 }} />)}
          </button>
        </div>

        {mobileMenuOpen && (
          <div style={{ padding: '12px 32px 24px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid rgba(201,136,42,0.12)', background: 'rgba(15,10,0,0.97)' }}>
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '13px 8px', fontSize: 15, color: 'rgba(255,255,255,0.70)', textDecoration: 'none', fontFamily: SANS }}>
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{
              marginTop: 10, padding: '16px', borderRadius: 9999, textAlign: 'center',
              background: `linear-gradient(135deg, ${P}, ${PD})`,
              color: 'white', fontWeight: 500, fontSize: 15, textDecoration: 'none', fontFamily: SANS,
            }}>Iniciar sesión</Link>
          </div>
        )}
      </nav>

      {/* ── HERO — dark left, photo right ── */}
      <section style={{
        minHeight: '100vh', display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden',
      }} className="landing-hero-grid">

        {/* Left: DARK panel */}
        <div className="landing-hero-text" style={{
          background: DK,
          position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: 'clamp(80px,8vw,120px) clamp(32px,5vw,72px)',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          {/* Subtle crimson radial glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 55% at 25% 55%, rgba(74,124,89,0.18) 0%, transparent 70%)',
          }} />

          <div style={{ position: 'relative', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="hero-reveal hero-delay-1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(74,124,89,0.35)', borderRadius: 9999,
              padding: '7px 18px', marginBottom: 36,
              background: 'rgba(74,124,89,0.12)',
            }}>
              <span style={{ fontSize: 13 }}>🌿</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#4A7C59', letterSpacing: '0.06em', fontFamily: SANS }}>
                Cuidado familiar coordinado
              </span>
            </div>

            <h1 className="hero-reveal hero-delay-2" style={{
              fontFamily: SERIF, fontStyle: 'italic',
              fontSize: 'clamp(36px, 4.5vw, 72px)',
              fontWeight: 700, color: 'white', lineHeight: 1.08,
              margin: '0 0 28px', letterSpacing: '-1px',
              textAlign: 'center',
            }}>
              Cuida a quien amas,{' '}
              <span style={{ color: AU }}>sin perder ningún detalle</span>
            </h1>

            <p className="hero-reveal hero-delay-3" style={{
              fontSize: 'clamp(14px, 1.4vw, 17px)', color: 'rgba(255,255,255,0.60)',
              lineHeight: 1.80, margin: '0 0 48px',
              fontFamily: SANS, fontWeight: 300, textAlign: 'center',
            }}>
              FamiliaCerca coordina medicamentos, rutinas y bienestar de tu familiar entre todos los cuidadores — en tiempo real, desde el celular.
            </p>

            <Link to="/login" className="hero-reveal hero-delay-4" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 44px', borderRadius: 9999, marginBottom: 32,
              background: '#4A7C59', color: 'white',
              fontWeight: 600, fontSize: 16, fontFamily: SANS,
              textDecoration: 'none', letterSpacing: '0.02em',
              boxShadow: '0 12px 40px rgba(74,124,89,0.40)',
            }}>
              Empezar gratis <span style={{ fontSize: 18, opacity: 0.85 }}>→</span>
            </Link>

            <div className="hero-reveal hero-delay-5" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Gratis para empezar', 'Sin App Store', 'iPhone y Android'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12, color: SG, fontWeight: 600 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', fontWeight: 300, fontFamily: SANS }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: edge-to-edge photo + floating elements */}
        <div className="landing-hero-right" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
          <img src={HERO_IMG} alt="Familia cuidando juntos" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top', display: 'block',
          }} />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to right, rgba(15,10,0,0.40) 0%, transparent 28%)',
            pointerEvents: 'none',
          }} />

        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section ref={statsRef} style={{ background: SF, padding: '60px 32px 72px', borderBottom: `1px solid ${BD}` }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
          {statItems.flatMap((s, i) => {
            const el = (
              <div key={`s${i}`} style={{ textAlign: 'center', padding: '0 44px' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{s.icon}</div>
                <p style={{ margin: 0, fontFamily: SERIF, fontSize: 'clamp(34px, 4.5vw, 58px)', fontWeight: 700, color: P, lineHeight: 1 }}>{s.val}</p>
                <p style={{ margin: '10px 0 0', fontSize: 13, fontFamily: SANS, fontWeight: 300, color: '#7A6E62', letterSpacing: '0.02em' }}>{s.label}</p>
              </div>
            )
            const div = i < statItems.length - 1 ? (
              <div key={`d${i}`} className="landing-divider"
                style={{ width: 1, height: 88, background: `linear-gradient(to bottom, transparent, rgba(74,124,89,0.25), transparent)`, flexShrink: 0 }} />
            ) : null
            return div ? [el, div] : [el]
          })}
        </div>
      </section>

      {/* ── PROBLEMA — before/after ── */}
      <section style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="landing-problema-grid">
          <div style={{ position: 'relative', minHeight: 700, overflow: 'hidden' }} className="landing-problema-img">
            <img src={PROB_IMG} alt="El reto del cuidado familiar" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block',
            }} />
          </div>
          <div style={{ background: DK, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(56px,8vw,96px) clamp(36px,6vw,80px)' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: AU, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>El problema</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 600, color: 'white', lineHeight: 1.12, margin: '0 0 32px' }}>
              Cuidar a un familiar mayor es un trabajo en equipo sin coordinación
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', fontFamily: SANS, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Sin FamiliaCerca</p>
                {['¿Ya le diste el medicamento?', 'Listas en papel que nadie ve', 'Duplicaciones y olvidos', 'WhatsApp caótico'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 9 }}>
                    <span style={{ color: '#E05555', fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✕</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: SANS, fontWeight: 300, lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(74,124,89,0.12)', border: `1px solid rgba(74,124,89,0.30)`, borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 500, color: '#6DBF8A', fontFamily: SANS, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Con FamiliaCerca</p>
                {['Todos ven el mismo historial', 'Confirmación con foto', 'Notificaciones en tiempo real', 'Todo en un solo lugar'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 9 }}>
                    <span style={{ color: '#6DBF8A', fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', fontFamily: SANS, fontWeight: 300, lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS MARQUEE ── */}
      <section style={{ background: P, padding: '18px 0', overflow: 'hidden' }}>
        <div className="marquee-container">
          <div className="marquee-track">
            {[...marqueePain, ...marqueePain].map((item, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '0 32px', whiteSpace: 'nowrap',
                fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: SANS, fontWeight: 400,
              }}>
                {item}
                <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: 18, lineHeight: 1 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── EMOTIONAL QUOTE ── */}
      <section style={{ padding: '128px 32px', background: DK }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: AU, lineHeight: 0.7, marginBottom: 20, opacity: 0.30 }}>"</div>
          <blockquote className="reveal" style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(26px,3.6vw,50px)',
            fontWeight: 500, color: AU, lineHeight: 1.45,
            margin: '0 0 24px',
          }}>
            Porque un día te vas a arrepentir de no haber registrado este momento.
          </blockquote>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)', fontFamily: SANS, fontWeight: 300, letterSpacing: '0.04em', margin: '0 0 40px' }}>
            — Cada familia que usa FamiliaCerca
          </p>
          <p className="reveal reveal-delay-2" style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(17px,2vw,26px)',
            color: 'rgba(201,136,42,0.60)', lineHeight: 1.55,
            margin: '0 0 56px',
          }}>
            "El cuidado empieza con la comunicación."
          </p>
          <CTABtn to="/login">
            Empezar a registrar hoy <span style={{ fontSize: 17, opacity: 0.8 }}>→</span>
          </CTABtn>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funciones" style={{ padding: '128px 32px', background: SF, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle green radial glow behind title */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 400, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(74,124,89,0.06) 0%, transparent 70%)',
        }} />
        <div style={{ maxWidth: 1140, margin: '0 auto', position: 'relative' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Funciones</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 600, color: '#1C2B20', lineHeight: 1.1, margin: '0 0 20px' }}>
              Todo lo que necesitas en un solo lugar
            </h2>
            <p style={{ fontSize: 17, color: '#6B7E70', lineHeight: 1.78, maxWidth: 540, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
              FamiliaCerca coordina a toda la familia para que ningún detalle del cuidado quede sin atender.
            </p>
          </div>

          {/* 3 large hero cards with mini mockups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>

            {/* Medicamentos */}
            <div className="feature-hero-card reveal" style={{ background: SW, borderRadius: 20, border: `1px solid rgba(74,124,89,0.20)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(74,124,89,0.08)', minHeight: 380, position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>💊</div>
              <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(201,136,42,0.30)`, marginBottom: 12, background: 'rgba(201,136,42,0.07)' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: AU, letterSpacing: '0.08em', fontFamily: SANS }}>Lo más importante</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: '#1C2B20', margin: '0 0 10px', lineHeight: 1.2 }}>Control de medicamentos</h3>
              <p style={{ fontSize: 14, color: '#6B7E70', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                Registra cada medicamento con horario y dosis. Confirma con foto de prueba y notifica a todos en tiempo real.
              </p>
              <div style={{ background: SA, borderRadius: 12, padding: '12px 14px', border: `1px solid rgba(74,124,89,0.12)` }}>
                {[
                  { label: 'Atenolol 25mg · 8am', done: true },
                  { label: 'Metformina 500mg · 1pm', done: true },
                  { label: 'Losartán 50mg · 8pm', done: false },
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid rgba(74,124,89,0.10)` : 'none' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: item.done ? P : 'transparent', border: `1.5px solid ${item.done ? P : 'rgba(74,124,89,0.30)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.done && <span style={{ color: 'white', fontSize: 9 }}>✓</span>}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: SANS, color: item.done ? '#9BA89F' : '#3A5C45', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="feature-hero-card reveal reveal-delay-1" style={{ background: SW, borderRadius: 20, border: `1px solid rgba(74,124,89,0.20)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(74,124,89,0.08)', minHeight: 380, position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>💬</div>
              <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(201,136,42,0.30)`, marginBottom: 12, background: 'rgba(201,136,42,0.07)' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: AU, letterSpacing: '0.08em', fontFamily: SANS }}>En tiempo real</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: '#1C2B20', margin: '0 0 10px', lineHeight: 1.2 }}>Chat familiar coordinado</h3>
              <p style={{ fontSize: 14, color: '#6B7E70', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                Un grupo dedicado solo al cuidado. Sin mezclar con WhatsApp. Notas de turno visibles para todos.
              </p>
              <div style={{ background: SA, borderRadius: 12, padding: '12px', border: `1px solid rgba(74,124,89,0.12)`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { from: 'María', msg: 'Ya le di las pastillas 💊', mine: false },
                  { from: 'Yo', msg: 'Perfecto! Voy al doctor a las 3', mine: true },
                  { from: 'Carlos', msg: 'Llego a las 5 para relevarte', mine: false },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '82%', padding: '6px 10px', borderRadius: 10, background: b.mine ? P : 'white', border: b.mine ? 'none' : `1px solid rgba(74,124,89,0.15)` }}>
                      {!b.mine && <p style={{ margin: '0 0 2px', fontSize: 9, color: AU, fontFamily: SANS, fontWeight: 500 }}>{b.from}</p>}
                      <p style={{ margin: 0, fontSize: 11, color: b.mine ? 'white' : '#3A5C45', fontFamily: SANS, lineHeight: 1.4 }}>{b.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Memorias */}
            <div className="feature-hero-card reveal reveal-delay-2" style={{ background: SW, borderRadius: 20, border: `1px solid rgba(74,124,89,0.20)`, padding: '36px 30px', boxShadow: '0 4px 24px rgba(74,124,89,0.08)', minHeight: 380, position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>📸</div>
              <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 9999, border: `1px solid rgba(201,136,42,0.30)`, marginBottom: 12, background: 'rgba(201,136,42,0.07)' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: AU, letterSpacing: '0.08em', fontFamily: SANS }}>Exclusivo Familiar</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: '#1C2B20', margin: '0 0 10px', lineHeight: 1.2 }}>Álbum de memorias</h3>
              <p style={{ fontSize: 14, color: '#6B7E70', lineHeight: 1.75, margin: '0 0 20px', fontFamily: SANS, fontWeight: 300 }}>
                Guarda fotos, notas de voz y momentos especiales junto al registro de salud. El cuidado también es amor.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                {['🌻','👴','❤️','🎂','🌿','💐'].map((em, i) => (
                  <div key={i} style={{ aspectRatio: '1', borderRadius: 10, background: i % 2 === 0 ? SA : 'rgba(74,124,89,0.08)', border: `1px solid rgba(74,124,89,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{em}</div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 secondary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {[
              { icon: '✅', title: 'Checklist diario', desc: 'Baño, comidas, ejercicio, cambios de posición — marcado en tiempo real.' },
              { icon: '🆘', title: 'Botón SOS', desc: 'Alerta instantánea a todos los cuidadores con un solo toque en caso de emergencia.' },
              { icon: '💰', title: 'Gastos de salud', desc: 'Control de medicamentos, consultas y terapias sin perder ningún gasto deducible.' },
            ].map((f, i) => (
              <div key={f.title} className={`reveal reveal-delay-${i}`} style={{ background: SW, borderRadius: 16, border: `1px solid rgba(74,124,89,0.18)`, padding: '26px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', boxShadow: '0 2px 12px rgba(74,124,89,0.06)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(74,124,89,0.10)', border: `1px solid rgba(74,124,89,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: '#1C2B20', margin: '0 0 6px' }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: '#6B7E70', lineHeight: 1.7, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS — 2×3 dark grid ── */}
      <section style={{ padding: '128px 32px', background: DK }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: AU, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Testimonios</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 600, color: 'white', lineHeight: 1.1, margin: 0 }}>
              Familias que cuidan mejor juntas
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="testimonios-grid">
            {[
              { name: 'María G.',    initial: 'M', role: 'Hija cuidadora',          location: 'Houston, Texas',             text: 'Antes mi hermano y yo nos peleábamos porque ninguno sabía si mamá ya había tomado su pastilla. Ahora con FamiliaCerca todos vemos lo mismo al mismo tiempo. ¡Nos salvó la convivencia familiar!' },
              { name: 'Roberto S.',  initial: 'R', role: 'Hijo mayor',               location: 'Los Ángeles, California',    text: 'La función de foto de prueba fue un cambio total. Ahora tenemos evidencia de cada medicamento y podemos mostrársela al cardiólogo. El doctor quedó impresionado con el registro.' },
              { name: 'Carmen L.',   initial: 'C', role: 'Enfermera, uso personal',  location: 'Miami, Florida',             text: 'Llevo 15 años como enfermera y nunca había visto una app tan práctica para el cuidado en casa. La recomiendo a todas las familias de mis pacientes.' },
              { name: 'Patricia V.', initial: 'P', role: 'Coordinadora familiar',    location: 'San Juan, Puerto Rico',      text: 'Somos 4 hermanos en distintos estados cuidando a nuestro papá. FamiliaCerca nos unió. Cada uno sabe qué le toca y cuándo. Ya no hay excusas ni confusiones.' },
              { name: 'Jorge M.',    initial: 'J', role: 'Esposo cuidador',          location: 'Nueva York, NY',             text: 'Mi esposa tiene Alzheimer y el checklist diario me salvó. Puedo registrar cada comida, cada baño, cada medicamento. Por fin duermo tranquilo sabiendo que nada se me escapa.' },
              { name: 'Lucía R.',    initial: 'L', role: 'Hija única',               location: 'Chicago, Illinois',          text: 'Cuido sola a mis dos padres mayores desde hace 3 años. FamiliaCerca me ayuda a organizarme y el botón SOS me da tranquilidad cuando no estoy en casa. No sé cómo lo hacía antes.' },
            ].map((t, i) => (
              <div key={t.name} className={`reveal reveal-delay-${i % 3}`} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 20,
                border: `1px solid rgba(74,124,89,0.28)`,
                padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.20)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ color: AU, fontSize: 13 }}>★</span>)}
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, margin: '0 0 24px', fontFamily: SANS, fontWeight: 300, fontStyle: 'italic', flex: 1 }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: P, border: `1px solid rgba(74,124,89,0.60)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: 'white' }}>{t.initial}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'white', fontFamily: SANS }}>{t.name}</p>
                    <p style={{ margin: '2px 0 6px', fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: SANS, fontWeight: 300 }}>{t.role}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(201,136,42,0.10)', borderRadius: 9999, padding: '2px 10px' }}>
                      <span style={{ fontSize: 9 }}>📍</span>
                      <span style={{ fontSize: 10, color: AU, fontFamily: SANS, fontWeight: 300 }}>{t.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA — light bg ── */}
      <section id="como" style={{ padding: '128px 32px', background: SF }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 88, flexWrap: 'wrap' }} className="como-grid">
          <div style={{ flex: '1 1 360px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 18px', fontFamily: SANS }}>Cómo funciona</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.8vw,50px)', fontWeight: 600, color: '#1C2B20', lineHeight: 1.12, margin: '0 0 52px' }}>
              Listo en 3 minutos, funciona para siempre
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div className="como-line" style={{ position: 'absolute', left: 39, top: 64, bottom: 64, width: 2, background: `linear-gradient(to bottom, ${P}, rgba(74,124,89,0.10))` }} />
              {[
                { n: '1', title: 'Crea tu cuenta gratis', desc: 'Regístrate con tu correo. Sin tarjeta de crédito, sin descarga en tienda de apps.' },
                { n: '2', title: 'Agrega a tu familiar y los cuidadores', desc: 'Invita a tus hermanos, pareja o cualquier persona que cuide al familiar. Cada uno tiene su propio acceso.' },
                { n: '3', title: 'Configura medicamentos y rutinas', desc: 'Carga los medicamentos con horarios. La app recuerda a cada cuidador qué toca y cuándo.' },
                { n: '4', title: 'Coordínense en tiempo real', desc: 'Cada confirmación, nota o alerta llega a todos al instante. Nunca más "¿ya lo hiciste?".' },
              ].map((s, i, arr) => (
                <div key={s.n} className={`reveal reveal-delay-${i}`} style={{ display: 'flex', gap: 24, marginBottom: i < arr.length - 1 ? 32 : 0 }}>
                  <div style={{ flexShrink: 0, zIndex: 1 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`, color: 'white', fontWeight: 700, fontSize: 28, fontFamily: SERIF, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 40px rgba(74,124,89,0.30)` }}>{s.n}</div>
                  </div>
                  <div style={{ paddingTop: 22 }}>
                    <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: '#1C2B20', margin: '0 0 8px' }}>{s.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B7E70', lineHeight: 1.78, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 52 }}>
              <CTABtn to="/login">Empezar ahora — es gratis</CTABtn>
            </div>
          </div>
          <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }} className="como-img">
            <img src={COMO_IMG} alt="Cómo funciona FamiliaCerca" style={{ width: '100%', borderRadius: 24, boxShadow: '0 16px 64px rgba(74,124,89,0.18)', border: `1px solid rgba(74,124,89,0.12)` }} />
          </div>
        </div>
      </section>

      {/* ── FEATURES MARQUEE ── */}
      <section style={{ background: P, padding: '18px 0', overflow: 'hidden' }}>
        <div className="marquee-container">
          <div className="marquee-track marquee-track-reverse">
            {[...marqueeFeatures, ...marqueeFeatures].map((item, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '0 32px', whiteSpace: 'nowrap',
                fontSize: 14, color: 'rgba(255,255,255,0.65)', fontFamily: SANS, fontWeight: 300,
              }}>
                {item}
                <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 18, lineHeight: 1 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS — annual toggle + guarantee ── */}
      <section id="precios" style={{ padding: '128px 32px', background: SF }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Precios</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 600, color: DK, lineHeight: 1.1, margin: '0 0 16px' }}>Simple y transparente</h2>
            <p style={{ fontSize: 17, color: '#6B5848', lineHeight: 1.75, maxWidth: 460, margin: '0 auto 36px', fontFamily: SANS, fontWeight: 300 }}>
              Empieza gratis, actualiza cuando lo necesites. Sin contratos ni sorpresas.
            </p>
            <div style={{ display: 'inline-flex', background: 'white', borderRadius: 9999, padding: 4, border: `1px solid ${BD}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <button onClick={() => setAnnual(false)} style={{ padding: '10px 28px', borderRadius: 9999, border: 'none', cursor: 'pointer', background: !annual ? P : 'transparent', color: !annual ? 'white' : '#6B5848', fontSize: 14, fontFamily: SANS, fontWeight: 500, transition: 'background 0.2s, color 0.2s' }}>Mensual</button>
              <button onClick={() => setAnnual(true)} style={{ padding: '10px 28px', borderRadius: 9999, border: 'none', cursor: 'pointer', background: annual ? P : 'transparent', color: annual ? 'white' : '#6B5848', fontSize: 14, fontFamily: SANS, fontWeight: 500, transition: 'background 0.2s, color 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}>
                Anual
                <span style={{ background: SG, color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500 }}>-20%</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
            {plans.map(p => <PriceCard key={p.name} {...p} annual={annual} />)}
          </div>
          <div className="reveal" style={{ textAlign: 'center', marginTop: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: 'white', borderRadius: 18, padding: '18px 30px', border: `1px solid ${BD}`, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <span style={{ fontSize: 26 }}>🛡️</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: DK, fontFamily: SANS }}>Prueba 14 días gratis — sin tarjeta de crédito</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PWA ── */}
      <section style={{ padding: '128px 32px', background: '#2D5016' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 72, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 18px', fontFamily: SANS }}>Sin App Store</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.8vw,50px)', fontWeight: 600, color: 'white', lineHeight: 1.12, margin: '0 0 18px' }}>
              Agrégala a tu celular en segundos
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.62)', lineHeight: 1.80, margin: '0 0 40px', fontFamily: SANS, fontWeight: 300 }}>
              Sin pasar por la App Store ni Google Play — funciona como una app nativa directo desde tu navegador.
            </p>
            {/* Platform tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.10)', borderRadius: 9999, padding: 4, marginBottom: 28, width: 'fit-content' }}>
              {[{ id: 'iphone', label: '🍎 iPhone' }, { id: 'android', label: '🤖 Android' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPwaTab(tab.id)}
                  style={{
                    padding: '8px 20px', borderRadius: 9999, border: 'none',
                    background: pwaTab === tab.id ? 'white' : 'transparent',
                    color: pwaTab === tab.id ? '#4A7C59' : 'rgba(255,255,255,0.60)',
                    fontWeight: pwaTab === tab.id ? 700 : 400,
                    fontSize: 13, fontFamily: SANS, cursor: 'pointer',
                    transition: 'all 0.18s',
                  }}
                >
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
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '1.5px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: 'white', flexShrink: 0 }}>{s.n}</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontFamily: SANS, fontWeight: 300, paddingTop: 8, margin: 0 }}>{s.text}</p>
              </div>
            ))}

            {/* Install button — only on Android tab when native prompt is ready */}
            {installed ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 22px', borderRadius: 9999, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.30)', marginTop: 8 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'white', fontFamily: SANS }}>¡App ya instalada!</span>
              </div>
            ) : (pwaTab === 'android' && canPrompt) ? (
              <button
                onClick={async () => {
                  const outcome = await install()
                  if (outcome === 'accepted') setPwaInstallClicked(true)
                }}
                style={{
                  marginTop: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '15px 32px', borderRadius: 9999, border: 'none',
                  background: 'white', color: '#4A7C59',
                  fontWeight: 700, fontSize: 15, fontFamily: SANS,
                  cursor: 'pointer', letterSpacing: '0.02em',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
                }}
              >
                {pwaInstallClicked ? '¡Instalando! 🎉' : '📲 Instalar ahora'}
              </button>
            ) : null}
          </div>
          {/* Phone home screen mockup */}
          <div style={{ flex: '0 0 280px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 260, height: 520, background: '#1A1A1A', borderRadius: 40, padding: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.50)', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 56, height: 18, background: '#1A1A1A', borderRadius: '0 0 12px 12px', zIndex: 2 }} />
              <div style={{ width: '100%', height: '100%', borderRadius: 32, background: 'linear-gradient(160deg, #1C1C2E 0%, #0F0F1A 100%)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 16px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: SANS }}>9:41</p>
                <p style={{ margin: '0 0 24px', fontSize: 9, color: 'rgba(255,255,255,0.18)', fontFamily: SANS }}>sábado, 23 mayo</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 20px rgba(74,124,89,0.50)', flexShrink: 0 }}>
                      <img src="/icon-192.png" alt="FamiliaCerca" style={{ width: 44, height: 44, display: 'block' }} />
                    </div>
                    <span style={{ fontSize: 8, color: 'white', fontFamily: SANS, textAlign: 'center', lineHeight: 1.2 }}>Familia Cerca</span>
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

      {/* ── FAQ — light ── */}
      <section id="faq" style={{ padding: '128px 32px', background: SA }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>Preguntas frecuentes</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 600, color: '#1C2B20', lineHeight: 1.1, margin: 0 }}>
              Todo lo que necesitas saber
            </h2>
          </div>
          {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} light />)}
        </div>
      </section>

      {/* ── CTA FINAL — full bleed, no boxed div ── */}
      <section style={{ position: 'relative', padding: '160px 32px', overflow: 'hidden', minHeight: 560, display: 'flex', alignItems: 'center' }}>
        <img src={CTA_IMG} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,10,0,0.84)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,26,18,0.60) 0%, transparent 52%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', width: '100%' }}>
          <div style={{ maxWidth: 680 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>Empieza hoy</p>
            <h2 className="reveal" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(44px,6vw,84px)', fontWeight: 700, color: 'white', lineHeight: 1.02, margin: '0 0 24px' }}>
              Cuida mejor,<br />juntos
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.62)', lineHeight: 1.80, margin: '0 0 48px', fontFamily: SANS, fontWeight: 300 }}>
              Únete a las familias que ya coordinan el cuidado de sus seres queridos con FamiliaCerca. Gratis para siempre en el plan básico.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <Link to="/login" style={{ padding: '20px 52px', borderRadius: 9999, background: 'white', color: P, fontWeight: 500, fontSize: 16, textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em', boxShadow: '0 16px 56px rgba(0,0,0,0.30)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                Crear cuenta gratis →
              </Link>
              <a href="#funciones" style={{ padding: '20px 36px', borderRadius: 9999, border: '1.5px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.78)', fontWeight: 400, fontSize: 15, textDecoration: 'none', fontFamily: SANS, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11 }}>▶</span> Ver demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER — dark ── */}
      <footer style={{ background: DK, padding: '64px 32px 48px', borderTop: '1px solid rgba(201,136,42,0.10)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 48, marginBottom: 52 }}>
            <div style={{ flex: '0 0 auto', maxWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <svg width={34} height={34} viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="20" fill={P} fillOpacity="0.15" />
                  <circle cx="20" cy="20" r="17" fill={P} />
                  <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="13" fontWeight="800" fontFamily="Georgia,serif" letterSpacing="-0.5">FC</text>
                  <text x="20" y="31" textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity="0.75" fontSize="9">♥</text>
                </svg>
                <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: 'white' }}>Familia<span style={{ color: AU }}>Cerca</span></span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', lineHeight: 1.7, fontFamily: SANS, fontWeight: 300, margin: '0 0 24px' }}>
                Cuidado familiar coordinado para la comunidad hispana. Medicamentos, rutinas y amor — todo en un solo lugar.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Instagram', href: 'https://www.instagram.com/familia.cerca/', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> },
                  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61589584865936', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg> },
                  { label: 'WhatsApp', href: 'https://wa.me/?text=Te%20comparto%20FamiliaCerca%2C%20una%20app%20para%20coordinar%20el%20cuidado%20familiar%20%F0%9F%92%9A%20familiacerca.com', icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z"/></svg> },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.color = AU; e.currentTarget.style.background = 'rgba(201,136,42,0.10)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  >{s.icon}</a>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Contacto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <a href="mailto:hola@familiacerca.com" style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                    onMouseEnter={e => e.currentTarget.style.color = AU}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                  >hola@familiacerca.com</a>
                  <a href="https://www.instagram.com/familia.cerca/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                    onMouseEnter={e => e.currentTarget.style.color = AU}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                  >@familia.cerca</a>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Producto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{label:'Funciones',href:'#funciones'},{label:'Precios',href:'#precios'},{label:'Cómo funciona',href:'#como'},{label:'Preguntas',href:'#faq'}].map(l => (
                    <a key={l.href} href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                    >{l.label}</a>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 18px', fontFamily: SANS }}>Legal</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{label:'Términos de uso',to:'/terminos'},{label:'Privacidad',to:'/privacidad'},{label:'Iniciar sesión',to:'/login'},{label:'Crear cuenta',to:'/login'}].map(l => (
                    <Link key={l.label} to={l.to} style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                    >{l.label}</Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)', margin: 0, fontFamily: SANS, fontWeight: 300 }}>© {new Date().getFullYear()} FamiliaCerca. Todos los derechos reservados.</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.14)', margin: 0, fontFamily: SANS, fontWeight: 300 }}>Hecho con ❤️ para familias hispanohablantes</p>
          </div>
        </div>
      </footer>

      {/* PWA install banner — shown to mobile visitors who haven't installed yet */}
      <PWAInstallBanner />

      {/* ── STICKY BOTTOM BAR ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9000,
        background: P,
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.20)',
        opacity: showBar ? 1 : 0,
        transform: showBar ? 'translateY(0)' : 'translateY(100%)',
        transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: showBar ? 'all' : 'none',
      }}>
        <Link to="/login" style={{
          color: 'white', fontFamily: SANS, fontWeight: 500,
          fontSize: 'clamp(14px, 2vw, 16px)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          letterSpacing: '0.01em',
        }}>
          Instalar FamiliaCerca — es gratis
          <span style={{ fontSize: 18, opacity: 0.85 }}>→</span>
        </Link>
      </div>

      <style>{`
        /* Scroll reveal */
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1); }
        .reveal.in-view { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.12s; }
        .reveal-delay-2 { transition-delay: 0.24s; }
        .reveal-delay-3 { transition-delay: 0.36s; }

        /* Hero stagger */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        .hero-reveal { animation: fadeInUp 0.78s cubic-bezier(0.16,1,0.3,1) both; }
        .hero-delay-1 { animation-delay: 0.05s; }
        .hero-delay-2 { animation-delay: 0.18s; }
        .hero-delay-3 { animation-delay: 0.34s; }
        .hero-delay-4 { animation-delay: 0.50s; }
        .hero-delay-5 { animation-delay: 0.64s; }

        /* Marquee */
        @keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes marquee-scroll-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .marquee-container { overflow: hidden; }
        .marquee-track { display: flex; width: max-content; animation: marquee-scroll 52s linear infinite; }
        .marquee-track-reverse { animation: marquee-scroll-reverse 52s linear infinite; }
        .marquee-track:hover, .marquee-track-reverse:hover { animation-play-state: paused; }

        /* Feature card hover lift */
        .feature-hero-card { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease; }
        .feature-hero-card:hover { transform: translateY(-8px) !important; box-shadow: 0 28px 80px rgba(74,124,89,0.14) !important; }

        /* Badge pulse (gold ring) */
        @keyframes badge-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(201,136,42,0.55); } 70% { box-shadow: 0 0 0 10px rgba(201,136,42,0); } 100% { box-shadow: 0 0 0 0 rgba(201,136,42,0); } }
        .badge-pulse-anim { animation: badge-pulse-ring 2s cubic-bezier(0.66,0,0,1) infinite; }

        /* Notification badges soft pulse */
        @keyframes soft-pulse { 0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.15); } 50% { box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 0 0 5px rgba(45,106,79,0.10); } }

        /* Price cards */
        .price-card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .price-card-highlighted { transform: scale(1.04); }
        .price-card-hover:hover { transform: translateY(-5px) scale(1.01) !important; }
        .price-card-highlighted:hover { transform: translateY(-5px) scale(1.05) !important; }

        /* Como line */
        @keyframes grow-line { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        .como-line { transform-origin: top; animation: grow-line 1s ease-out 0.6s both; }

        /* FAQ dark/light hover */
        .faq-dark-item { transition: background 0.18s ease; border-radius: 8px; }
        .faq-dark-item:hover { background: rgba(201,136,42,0.04); }
        .faq-light-item { transition: background 0.18s ease; border-radius: 8px; }
        .faq-light-item:hover { background: rgba(74,124,89,0.05); }

        /* Responsive */
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
        }
        @media (max-width: 640px) {
          .landing-divider { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal, .hero-reveal, .marquee-track, .feature-hero-card,
          .badge-pulse-anim, .como-line {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
