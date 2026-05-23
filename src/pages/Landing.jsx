import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const HERO_IMG = 'https://i.postimg.cc/CKYvSgQ7/Chat-GPT-Image-May-22-2026-10-19-49-PM.png'
const PROB_IMG = 'https://i.postimg.cc/3JdVcYsn/Chat-GPT-Image-May-22-2026-10-21-19-PM.png'
const COMO_IMG = 'https://i.postimg.cc/hGTq3cd4/Chat-GPT-Image-May-22-2026-10-22-32-PM.png'
const CTA_IMG  = 'https://i.postimg.cc/hj8chcDs/Chat-GPT-Image-May-22-2026-10-23-48-PM.png'

const P    = '#8B1A1A'
const PD   = '#6B1010'
const AU   = '#C9882A'
const SG   = '#2D6A4F'
const DK   = '#0F0A00'
const SF   = '#FDF8F5'
const BD   = 'rgba(139,26,26,0.10)'

const SERIF = "'Cormorant Garamond', Georgia, serif"
const SANS  = "'Inter', system-ui, sans-serif"

const CTABtn = ({ to, children, style = {} }) => (
  <Link to={to} style={{
    display: 'inline-flex', alignItems: 'center', gap: 12,
    padding: '18px 52px', borderRadius: 9999,
    background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
    color: 'white', fontWeight: 500, fontSize: 16,
    textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.025em',
    boxShadow: `0 22px 64px rgba(139,26,26,0.48), 0 8px 24px rgba(139,26,26,0.28)`,
    ...style,
  }}>
    {children}
  </Link>
)

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${BD}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '22px 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 400, color: DK, lineHeight: 1.5, paddingRight: 16, fontFamily: SANS }}>
          {q}
        </span>
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `1.5px solid ${BD}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: P, flexShrink: 0,
          transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none',
          fontFamily: SANS,
        }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 15, color: '#5A4840', lineHeight: 1.85, paddingBottom: 24, margin: 0, fontFamily: SANS, fontWeight: 300 }}>
          {a}
        </p>
      )}
    </div>
  )
}

function PriceCard({ name, price, period, highlight, badge, features, cta }) {
  return (
    <div style={{
      flex: '1 1 280px', borderRadius: 24,
      background: highlight ? P : 'white',
      padding: '40px 30px',
      boxShadow: highlight
        ? `0 28px 88px rgba(139,26,26,0.38)`
        : `0 4px 28px rgba(0,0,0,0.07)`,
      border: highlight ? 'none' : `1px solid ${BD}`,
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          background: AU, color: 'white',
          fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
          padding: '5px 20px', borderRadius: 9999, whiteSpace: 'nowrap', fontFamily: SANS,
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
          {price === 0 ? 'Gratis' : `$${price}`}
        </span>
        {price > 0 && (
          <span style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF', fontFamily: SANS }}>/mes</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF', margin: '0 0 28px', fontFamily: SANS, fontWeight: 300 }}>
        {period}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, fontFamily: SANS, fontWeight: 300 }}>
            <span style={{
              color: f.included
                ? (highlight ? AU : SG)
                : (highlight ? 'rgba(255,255,255,0.20)' : '#D1D5DB'),
              flexShrink: 0, fontWeight: 500,
            }}>{f.included ? '✓' : '–'}</span>
            <span style={{
              color: f.included
                ? (highlight ? 'rgba(255,255,255,0.85)' : '#374151')
                : (highlight ? 'rgba(255,255,255,0.30)' : '#9CA3AF'),
            }}>{f.text}</span>
          </li>
        ))}
      </ul>
      <Link to="/login" style={{
        display: 'block', textAlign: 'center', padding: '16px',
        borderRadius: 9999, fontWeight: 500, fontSize: 15,
        textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em',
        background: highlight ? 'white' : 'transparent',
        color: highlight ? P : P,
        border: highlight ? 'none' : `1.5px solid ${P}`,
        boxShadow: highlight ? '0 6px 24px rgba(255,255,255,0.18)' : 'none',
      }}>{cta}</Link>
    </div>
  )
}

export default function Landing() {
  const { user, loading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  if (loading) return null
  if (user) return <Navigate to="/hoy" replace />

  const navLinks = [
    { label: 'Funciones', href: '#funciones' },
    { label: 'Cómo funciona', href: '#como' },
    { label: 'Precios', href: '#precios' },
    { label: 'Preguntas', href: '#faq' },
  ]

  const stats = [
    { n: '500+', label: 'familias cuidando' },
    { n: '98%', label: 'medicamentos a tiempo' },
    { n: '3 min', label: 'para estar listo' },
    { n: '0', label: 'contratos ni trampas' },
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
        { text: 'Foto de prueba de medicamentos', included: false },
        { text: 'Reportes y exportación PDF', included: false },
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
      a: 'En iPhone: abre la página en Safari, toca el botón de compartir (cuadro con flecha) y selecciona "Agregar a inicio". En Android: toca el menú de tres puntos del navegador y selecciona "Instalar aplicación" o "Agregar a pantalla de inicio".',
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
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${BD}`,
      }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto', padding: '0 32px',
          height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="20" fill={P} fillOpacity="0.08" />
              <circle cx="20" cy="20" r="17" fill={P} />
              <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="13" fontWeight="800"
                fontFamily="Georgia, serif" letterSpacing="-0.5">FC</text>
              <text x="20" y="31" textAnchor="middle" dominantBaseline="middle"
                fill="white" fillOpacity="0.75" fontSize="9">♥</text>
            </svg>
            <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: DK, letterSpacing: '0.01em' }}>
              FamiliaCerca
            </span>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="landing-desktop-nav">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} style={{
                fontSize: 14, fontWeight: 400, color: '#5A4840',
                textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.01em',
              }}
                onMouseEnter={e => e.target.style.color = P}
                onMouseLeave={e => e.target.style.color = '#5A4840'}
              >{l.label}</a>
            ))}
            <Link to="/login" style={{
              padding: '10px 26px', borderRadius: 9999,
              background: `linear-gradient(135deg, ${P}, ${PD})`,
              color: 'white', fontWeight: 500, fontSize: 14,
              textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em',
              boxShadow: `0 4px 18px rgba(139,26,26,0.32)`,
            }}>
              Iniciar sesión
            </Link>
          </div>

          {/* Hamburger */}
          <button onClick={() => setMobileMenuOpen(o => !o)} className="landing-hamburger"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}
            aria-label="Menú">
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 22, height: 1.5, background: DK, borderRadius: 2 }} />
            ))}
          </button>
        </div>

        {mobileMenuOpen && (
          <div style={{ padding: '12px 32px 24px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: `1px solid ${BD}`, background: 'white' }}>
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '13px 8px', fontSize: 15, color: DK, textDecoration: 'none', fontFamily: SANS }}>
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

      {/* ── HERO — 100vh, organic blob photo, floating phone ── */}
      <section style={{
        minHeight: '100vh', display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden', background: 'white',
        position: 'relative',
      }} className="landing-hero-grid">

        {/* Subtle warm radial bg */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `radial-gradient(ellipse 60% 80% at 20% 60%, ${SF} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Left: text */}
        <div className="landing-hero-text" style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(80px,8vw,140px) clamp(24px,4vw,56px) clamp(80px,8vw,140px) max(28px, calc((100vw - 1140px)/2 + 32px))',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: `1px solid ${BD}`, borderRadius: 9999,
            padding: '7px 18px', marginBottom: 36, width: 'fit-content',
          }}>
            <span style={{ fontSize: 13 }}>💊</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: P, letterSpacing: '0.06em', fontFamily: SANS }}>
              Cuidado familiar coordinado
            </span>
          </div>

          <h1 style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(56px, 7vw, 96px)',
            fontWeight: 700, color: DK, lineHeight: 1.02,
            margin: '0 0 28px', letterSpacing: '-1px',
          }}>
            Cuida a quien amas,{' '}
            <span style={{ color: P }}>sin perder ningún detalle</span>
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 1.8vw, 19px)', color: '#6B5848',
            lineHeight: 1.78, margin: '0 0 48px', maxWidth: 460,
            fontFamily: SANS, fontWeight: 300,
          }}>
            FamiliaCerca coordina medicamentos, rutinas y bienestar de tu familiar entre todos los cuidadores — en tiempo real, desde el celular.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 40 }}>
            <CTABtn to="/login">
              Empezar gratis <span style={{ fontSize: 18, opacity: 0.8 }}>→</span>
            </CTABtn>
            <a href="#como" style={{
              padding: '18px 30px', borderRadius: 9999,
              border: `1.5px solid ${BD}`, background: 'white',
              color: '#5A4840', fontWeight: 400, fontSize: 15,
              textDecoration: 'none', fontFamily: SANS,
              display: 'inline-flex', alignItems: 'center', gap: 9,
            }}>
              <span style={{ fontSize: 12 }}>▶</span> Ver cómo funciona
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {['Gratis para empezar', 'Sin App Store', 'iPhone y Android'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12, color: SG, fontWeight: 500 }}>✓</span>
                <span style={{ fontSize: 13, color: '#8A7060', fontWeight: 300, fontFamily: SANS }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: blob photo + floating phone mockup */}
        <div className="landing-hero-right" style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '60px 48px 60px 24px',
          minHeight: '100vh',
        }}>
          {/* Soft glow behind blob */}
          <div style={{
            position: 'absolute',
            width: '85%', height: '85%',
            background: `radial-gradient(ellipse at center, rgba(201,136,42,0.07) 0%, transparent 70%)`,
            borderRadius: '50%',
          }} />

          {/* Photo blob wrapper */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
            {/* Organic blob photo */}
            <div style={{
              borderRadius: '62% 38% 46% 54% / 60% 44% 56% 40%',
              overflow: 'hidden',
              aspectRatio: '4/5',
              boxShadow: `0 60px 120px rgba(139,26,26,0.16), 0 20px 40px rgba(0,0,0,0.10)`,
            }}>
              <img src={HERO_IMG} alt="Familia cuidando juntos" style={{
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center top',
                display: 'block',
              }} />
            </div>

            {/* Phone mockup — bottom-left of photo */}
            <div style={{
              position: 'absolute', bottom: 24, left: -64,
              zIndex: 3, filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.30))',
            }}>
              <div style={{
                width: 196, height: 390,
                background: DK, borderRadius: 34, padding: 8, position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                  width: 52, height: 16, background: DK,
                  borderRadius: '0 0 10px 10px', zIndex: 2,
                }} />
                <div style={{
                  width: '100%', height: '100%', borderRadius: 27,
                  background: 'white', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ background: P, padding: '26px 12px 14px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'white', fontSize: 10, fontWeight: 500, fontFamily: SANS, letterSpacing: '0.12em' }}>
                      FAMILIACERCA
                    </p>
                    <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 8, fontFamily: SANS }}>
                      Buenos días ☀️
                    </p>
                  </div>
                  <div style={{ padding: '10px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 8, fontWeight: 500, fontFamily: SANS, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Hoy
                    </p>
                    {[
                      { icon: '💊', label: 'Atenolol 25mg', done: true },
                      { icon: '💊', label: 'Metformina', done: false },
                      { icon: '✅', label: 'Baño diario', done: true },
                      { icon: '🍽️', label: 'Almuerzo', done: true },
                    ].map((item, i) => (
                      <div key={i} style={{
                        background: item.done ? '#F0F9F4' : '#FFF8F5',
                        borderRadius: 8, padding: '6px 8px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        border: `1px solid ${item.done ? 'rgba(45,106,79,0.15)' : BD}`,
                      }}>
                        <span style={{ fontSize: 11 }}>{item.icon}</span>
                        <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 400, color: DK, flex: 1 }}>{item.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 500, fontFamily: SANS, color: item.done ? SG : AU }}>
                          {item.done ? '✓' : '⏰'}
                        </span>
                      </div>
                    ))}
                    <div style={{ background: SF, borderRadius: 8, padding: '6px 8px', border: `1px solid ${BD}`, marginTop: 2 }}>
                      <p style={{ margin: 0, fontSize: 8, fontFamily: SANS, color: '#6B7280', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 500, color: DK }}>María: </span>
                        Ya le di el desayuno 👍
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge — top right */}
            <div style={{
              position: 'absolute', top: 32, right: -44,
              background: 'white', borderRadius: 16, padding: '11px 14px',
              boxShadow: '0 12px 44px rgba(0,0,0,0.13)',
              display: 'flex', alignItems: 'center', gap: 9, zIndex: 4,
              border: `1px solid ${BD}`,
            }}>
              <span style={{ fontSize: 19 }}>💊</span>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 500, fontFamily: SANS, color: DK }}>Medicamento dado</p>
                <p style={{ margin: 0, fontSize: 9, fontFamily: SANS, color: SG, fontWeight: 300 }}>✓ Con foto de prueba</p>
              </div>
            </div>

            {/* Floating badge — mid-left */}
            <div style={{
              position: 'absolute', top: '42%', left: -52,
              background: 'white', borderRadius: 14, padding: '10px 12px',
              boxShadow: '0 10px 36px rgba(0,0,0,0.11)',
              display: 'flex', alignItems: 'center', gap: 8, zIndex: 4,
              border: `1px solid ${BD}`,
            }}>
              <span style={{ fontSize: 17 }}>👨‍👩‍👧</span>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 500, fontFamily: SANS, color: DK }}>3 cuidadores</p>
                <p style={{ margin: 0, fontSize: 9, fontFamily: SANS, color: '#9CA3AF', fontWeight: 300 }}>en línea ahora</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR — #0F0A00 ── */}
      <section style={{ background: DK, padding: '52px 32px' }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap', gap: 0,
        }}>
          {stats.flatMap((s, i) => {
            const el = (
              <div key={`stat-${i}`} style={{ textAlign: 'center', padding: '0 52px' }}>
                <p style={{
                  margin: 0, fontFamily: SERIF, fontStyle: 'normal',
                  fontSize: 'clamp(40px, 5.5vw, 64px)',
                  fontWeight: 700, color: AU, lineHeight: 1,
                }}>{s.n}</p>
                <p style={{
                  margin: '8px 0 0', fontSize: 13, fontFamily: SANS,
                  fontWeight: 300, color: 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.02em',
                }}>{s.label}</p>
              </div>
            )
            const div = i < stats.length - 1 ? (
              <div key={`d-${i}`} style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
                className="landing-divider" />
            ) : null
            return div ? [el, div] : [el]
          })}
        </div>
      </section>

      {/* ── PROBLEMA — white bg, photo left ── */}
      <section style={{ padding: '128px 32px', background: 'white' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 72, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px' }}>
            <img src={PROB_IMG} alt="El reto del cuidado familiar" style={{
              width: '100%', borderRadius: 28,
              boxShadow: `0 32px 88px rgba(139,26,26,0.14), 0 8px 24px rgba(0,0,0,0.08)`,
              display: 'block',
            }} />
          </div>
          <div style={{ flex: '1 1 340px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>
              El problema
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: '0 0 24px',
            }}>
              Cuidar a un familiar mayor es un trabajo en equipo sin coordinación
            </h2>
            <p style={{ fontSize: 16, color: '#6B5848', lineHeight: 1.85, margin: '0 0 36px', fontFamily: SANS, fontWeight: 300 }}>
              ¿Cuántas veces te has preguntado si tu mamá ya tomó su medicamento? Sin una herramienta común, los mensajes se pierden en WhatsApp y los errores se repiten.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { icon: '😰', text: '"¿Ya le diste el medicamento o lo doy yo?"' },
                { icon: '📋', text: 'Listas en papel que nadie más puede ver' },
                { icon: '🔁', text: 'Medicamentos duplicados o saltados por falta de comunicación' },
              ].map(p => (
                <div key={p.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <span style={{
                    fontSize: 18, width: 48, height: 48, borderRadius: 14,
                    background: SF, border: `1px solid ${BD}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{p.icon}</span>
                  <p style={{ fontSize: 15, color: '#6B5848', lineHeight: 1.7, margin: 0, paddingTop: 12, fontFamily: SANS, fontWeight: 300 }}>
                    {p.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── EMOTIONAL QUOTE — #0F0A00, gold italic ── */}
      <section style={{ padding: '128px 32px', background: DK }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: SERIF, fontSize: 'clamp(80px, 10vw, 140px)',
            color: AU, lineHeight: 0.7, marginBottom: 24, opacity: 0.4,
          }}>"</div>
          <blockquote style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 52px)',
            fontWeight: 500, color: AU, lineHeight: 1.4,
            margin: '0 0 40px',
          }}>
            Porque un día te vas a arrepentir de no haber registrado este momento.
          </blockquote>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.35)',
            fontFamily: SANS, fontWeight: 300, letterSpacing: '0.04em',
            margin: '0 0 56px',
          }}>
            — Cada familia que usa FamiliaCerca
          </p>
          <CTABtn to="/login">
            Empezar a registrar hoy <span style={{ fontSize: 17, opacity: 0.8 }}>→</span>
          </CTABtn>
        </div>
      </section>

      {/* ── FEATURES — white, 3 large hero cards ── */}
      <section id="funciones" style={{ padding: '128px 32px', background: 'white' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>
              Funciones
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: '0 0 20px',
            }}>
              Todo lo que necesitas en un solo lugar
            </h2>
            <p style={{ fontSize: 18, color: '#6B5848', lineHeight: 1.78, maxWidth: 560, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
              FamiliaCerca coordina a toda la familia para que ningún detalle del cuidado quede sin atender.
            </p>
          </div>

          {/* 3 large hero feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 24, marginBottom: 24 }}>
            {[
              {
                icon: '💊',
                tag: 'Lo más importante',
                title: 'Control de medicamentos',
                desc: 'Registra cada medicamento con horario y dosis. Confirma cuando se dio con foto de prueba y notificaciones en tiempo real para todos los cuidadores. Cero errores.',
              },
              {
                icon: '💬',
                tag: 'En tiempo real',
                title: 'Chat familiar coordinado',
                desc: 'Un grupo dedicado solo al cuidado de tu familiar. Sin mezclar con WhatsApp. Notas de turno, actualizaciones y alertas en un solo lugar visible para todos.',
              },
              {
                icon: '📸',
                tag: 'Exclusivo Familiar',
                title: 'Álbum de memorias',
                desc: 'Guarda fotos, notas de voz y momentos especiales junto al registro de salud. Porque el cuidado también es amor y esos momentos merecen ser recordados.',
              },
            ].map(f => (
              <div key={f.title} style={{
                background: 'white', borderRadius: 20,
                border: `1px solid ${BD}`, padding: '40px 34px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.07)',
                transition: 'box-shadow 0.2s',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: `rgba(139,26,26,0.07)`, border: `1px solid ${BD}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, marginBottom: 24,
                }}>{f.icon}</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '4px 14px', borderRadius: 9999,
                  border: `1px solid ${BD}`, marginBottom: 16,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: P, letterSpacing: '0.08em', fontFamily: SANS }}>
                    {f.tag}
                  </span>
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: DK, margin: '0 0 14px', lineHeight: 1.2 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 15, color: '#6B5848', lineHeight: 1.8, margin: 0, fontFamily: SANS, fontWeight: 300 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* 3 secondary compact features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {[
              { icon: '✅', title: 'Checklist diario', desc: 'Baño, comidas, ejercicio, cambios de posición — marcado en tiempo real.' },
              { icon: '🆘', title: 'Botón SOS', desc: 'Alerta instantánea a todos los cuidadores con un solo toque en caso de emergencia.' },
              { icon: '💰', title: 'Gastos de salud', desc: 'Control de medicamentos, consultas y terapias sin perder ningún gasto deducible.' },
            ].map(f => (
              <div key={f.title} style={{
                background: SF, borderRadius: 16,
                border: `1px solid ${BD}`, padding: '26px 24px',
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: `rgba(139,26,26,0.06)`, border: `1px solid ${BD}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>{f.icon}</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: DK, margin: '0 0 6px' }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: '#6B5848', lineHeight: 1.7, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS — #FDF8F5, white cards, gold quote marks ── */}
      <section style={{ padding: '128px 32px', background: SF }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>
              Testimonios
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: 0,
            }}>
              Familias que cuidan mejor juntas
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 24 }}>
            {[
              {
                name: 'María G.', role: 'Hija cuidadora, Monterrey', avatar: '👩',
                text: 'Antes mi hermano y yo nos peleábamos porque ninguno sabía si mi mamá ya había tomado su pastilla. Ahora con FamiliaCerca todos vemos lo mismo al mismo tiempo. ¡Nos salvó la convivencia familiar!',
              },
              {
                name: 'Roberto S.', role: 'Hijo mayor, Ciudad de México', avatar: '👨',
                text: 'La función de foto de prueba fue un cambio total. Ahora tenemos evidencia de cada medicamento y podemos mostrársela al cardiólogo. El doctor quedó impresionado con el registro.',
              },
              {
                name: 'Carmen L.', role: 'Enfermera y cuidadora, Guadalajara', avatar: '👩‍⚕️',
                text: 'Llevo 15 años como enfermera y nunca había visto una app tan práctica para el cuidado en casa. La recomiendo a todas las familias de mis pacientes.',
              },
            ].map(t => (
              <div key={t.name} style={{
                background: 'white', borderRadius: 20,
                border: `1px solid ${BD}`, padding: '36px 30px',
                boxShadow: '0 4px 28px rgba(0,0,0,0.06)',
              }}>
                {/* Gold quote mark */}
                <div style={{
                  fontFamily: SERIF, fontSize: 64,
                  color: AU, lineHeight: 0.7,
                  marginBottom: 20, opacity: 0.8,
                }}>"</div>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: AU, fontSize: 14 }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: 15, color: '#5A4840', lineHeight: 1.85, margin: '0 0 28px', fontFamily: SANS, fontWeight: 300, fontStyle: 'italic' }}>
                  {t.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: SF, border: `1px solid ${BD}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>{t.avatar}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: DK, fontFamily: SANS }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', fontFamily: SANS, fontWeight: 300 }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA — #FDF8F5, large bold crimson circles ── */}
      <section id="como" style={{ padding: '128px 32px', background: 'white' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 88, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 18px', fontFamily: SANS }}>
              Cómo funciona
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: '0 0 56px',
            }}>
              Listo en 3 minutos, funciona para siempre
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { n: '1', title: 'Crea tu cuenta gratis', desc: 'Regístrate con tu correo. Sin tarjeta de crédito, sin descarga en tienda de apps.' },
                { n: '2', title: 'Agrega a tu familiar y los cuidadores', desc: 'Invita a tus hermanos, pareja o cualquier persona que cuide al familiar. Cada uno tiene su propio acceso.' },
                { n: '3', title: 'Configura medicamentos y rutinas', desc: 'Carga los medicamentos con horarios. La app recuerda a cada cuidador qué toca y cuándo.' },
                { n: '4', title: 'Coordínense en tiempo real', desc: 'Cada confirmación, nota o alerta llega a todos al instante. Nunca más "¿ya lo hiciste?".' },
              ].map((s, i, arr) => (
                <div key={s.n} style={{ display: 'flex', gap: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
                      color: 'white', fontWeight: 700, fontSize: 26,
                      fontFamily: SERIF,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 12px 36px rgba(139,26,26,0.40)`,
                    }}>{s.n}</div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: BD, margin: '10px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 40 : 0, paddingTop: 16 }}>
                    <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: DK, margin: '0 0 8px' }}>{s.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B5848', lineHeight: 1.78, margin: 0, fontFamily: SANS, fontWeight: 300 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 52 }}>
              <CTABtn to="/login">Empezar ahora — es gratis</CTABtn>
            </div>
          </div>
          <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}>
            <img src={COMO_IMG} alt="Cómo funciona FamiliaCerca" style={{
              width: '100%', borderRadius: 24,
              boxShadow: `0 24px 80px rgba(0,0,0,0.12)`,
            }} />
          </div>
        </div>
      </section>

      {/* ── PRECIOS — white, popular card dark crimson ── */}
      <section id="precios" style={{ padding: '128px 32px', background: SF }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>
              Precios
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: '0 0 16px',
            }}>
              Simple y transparente
            </h2>
            <p style={{ fontSize: 17, color: '#6B5848', lineHeight: 1.75, maxWidth: 460, margin: '0 auto', fontFamily: SANS, fontWeight: 300 }}>
              Empieza gratis, actualiza cuando lo necesites. Sin contratos ni sorpresas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
            {plans.map(p => <PriceCard key={p.name} {...p} />)}
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL — white ── */}
      <section style={{ padding: '128px 32px', background: 'white' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: SF, border: `1px solid ${BD}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, margin: '0 auto 28px',
          }}>📲</div>
          <h2 style={{
            fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 600, color: DK, lineHeight: 1.12, margin: '0 0 20px',
          }}>
            Instálala como una app nativa
          </h2>
          <p style={{ fontSize: 16, color: '#6B5848', lineHeight: 1.8, margin: '0 auto 52px', maxWidth: 520, fontFamily: SANS, fontWeight: 300 }}>
            FamiliaCerca es una PWA — funciona como una app normal en tu celular sin pasar por la App Store ni Google Play.
          </p>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 52 }}>
            {[
              {
                emoji: '🍎', title: 'iPhone / Safari',
                steps: ['Abre FamiliaCerca en Safari', 'Toca el botón Compartir (↑)', 'Elige "Agregar a inicio"', '¡Listo!'],
              },
              {
                emoji: '🤖', title: 'Android / Chrome',
                steps: ['Abre FamiliaCerca en Chrome', 'Toca el menú ⋮ (tres puntos)', 'Elige "Instalar aplicación"', '¡Listo!'],
              },
            ].map(card => (
              <div key={card.title} style={{
                flex: '1 1 260px', background: SF, borderRadius: 20,
                border: `1px solid ${BD}`, padding: '32px 28px',
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{card.emoji}</div>
                <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: DK, margin: '0 0 16px' }}>{card.title}</h3>
                <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {card.steps.map((s, i) => (
                    <li key={i} style={{ fontSize: 14, color: '#6B5848', lineHeight: 1.65, fontFamily: SANS, fontWeight: 300 }}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <a href="https://familiacerca.netlify.app" target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '18px 52px', borderRadius: 9999,
            background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
            color: 'white', fontWeight: 500, fontSize: 16,
            textDecoration: 'none', fontFamily: SANS, letterSpacing: '0.02em',
            boxShadow: `0 22px 64px rgba(139,26,26,0.48), 0 8px 24px rgba(139,26,26,0.28)`,
          }}>
            <span style={{ fontSize: 20 }}>📲</span>
            Abrir e instalar FamiliaCerca
          </a>
          <p style={{ fontSize: 13, color: '#B0A090', marginTop: 16, fontFamily: SANS, fontWeight: 300 }}>
            Se abre en el navegador — luego sigue los pasos arriba para instalar
          </p>
        </div>
      </section>

      {/* ── FAQ — #FDF8F5 ── */}
      <section id="faq" style={{ padding: '128px 32px', background: SF }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: P, textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 16px', fontFamily: SANS }}>
              Preguntas frecuentes
            </p>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(36px, 4.5vw, 58px)',
              fontWeight: 600, color: DK, lineHeight: 1.1, margin: 0,
            }}>
              Todo lo que necesitas saber
            </h2>
          </div>
          {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── CTA FINAL — #8B1A1A gradient ── */}
      <section style={{ padding: '0 32px 128px', background: SF }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto',
          borderRadius: 32, overflow: 'hidden',
          background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px', padding: '80px 64px' }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.16em', margin: '0 0 20px', fontFamily: SANS }}>
                Empieza hoy
              </p>
              <h2 style={{
                fontFamily: SERIF, fontStyle: 'italic',
                fontSize: 'clamp(32px, 4vw, 54px)',
                fontWeight: 700, color: 'white', lineHeight: 1.1, margin: '0 0 20px',
              }}>
                Cuida mejor, juntos
              </h2>
              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: '0 0 44px', fontFamily: SANS, fontWeight: 300 }}>
                Únete a las familias que ya coordinan el cuidado de sus seres queridos con FamiliaCerca. Gratis para siempre en el plan básico.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <Link to="/login" style={{
                  padding: '18px 44px', borderRadius: 9999,
                  background: 'white', color: P,
                  fontWeight: 500, fontSize: 16, textDecoration: 'none',
                  fontFamily: SANS, letterSpacing: '0.02em',
                  boxShadow: '0 12px 44px rgba(0,0,0,0.20)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  Crear cuenta gratis →
                </Link>
                <Link to="/login" style={{
                  padding: '18px 30px', borderRadius: 9999,
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  color: 'white', fontWeight: 400, fontSize: 15,
                  textDecoration: 'none', fontFamily: SANS,
                  display: 'inline-flex', alignItems: 'center',
                }}>
                  Iniciar sesión
                </Link>
              </div>
            </div>
            <div style={{ flex: '1 1 300px', alignSelf: 'flex-end', overflow: 'hidden', maxHeight: 520 }}>
              <img src={CTA_IMG} alt="Familia feliz usando FamiliaCerca"
                style={{ width: '100%', height: 520, objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${BD}`, padding: '48px 32px', background: 'white' }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: DK }}>FamiliaCerca</span>
            <span style={{ fontSize: 13, color: P }}>♥</span>
            <span style={{ fontSize: 13, color: '#B0A090', fontFamily: SANS, fontWeight: 300 }}>Cuidado con amor</span>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Términos', to: '/terminos' },
              { label: 'Privacidad', to: '/privacidad' },
              { label: 'Iniciar sesión', to: '/login' },
            ].map(l => (
              <Link key={l.to} to={l.to} style={{ fontSize: 13, color: '#B0A090', textDecoration: 'none', fontFamily: SANS, fontWeight: 300 }}>
                {l.label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#D1C8C0', margin: 0, fontFamily: SANS, fontWeight: 300 }}>
            © {new Date().getFullYear()} FamiliaCerca. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .landing-desktop-nav { display: none !important; }
          .landing-hamburger { display: flex !important; }
          .landing-hero-grid { grid-template-columns: 1fr !important; min-height: auto !important; }
          .landing-hero-right { display: none !important; }
          .landing-hero-text { padding: 80px 28px 64px !important; min-height: auto !important; }
        }
        @media (max-width: 640px) {
          .landing-divider { display: none !important; }
        }
      `}</style>
    </div>
  )
}
