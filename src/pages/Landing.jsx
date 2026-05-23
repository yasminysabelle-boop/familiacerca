import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const HERO     = 'https://i.postimg.cc/CKYvSgQ7/Chat-GPT-Image-May-22-2026-10-19-49-PM.png'
const PROBLEMA = 'https://i.postimg.cc/3JdVcYsn/Chat-GPT-Image-May-22-2026-10-21-19-PM.png'
const COMO     = 'https://i.postimg.cc/hGTq3cd4/Chat-GPT-Image-May-22-2026-10-22-32-PM.png'
const CTA_IMG  = 'https://i.postimg.cc/hj8chcDs/Chat-GPT-Image-May-22-2026-10-23-48-PM.png'

const PRIMARY      = '#C4623A'
const PRIMARY_DARK = '#A85130'
const CREAM        = '#F9F4EE'
const SAGE         = '#4A7C59'

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #EDE5D8' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '20px 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4, paddingRight: 16 }}>
          {q}
        </span>
        <span style={{
          fontSize: 22, color: PRIMARY, flexShrink: 0,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(45deg)' : 'none',
          display: 'inline-block',
        }}>
          +
        </span>
      </button>
      {open && (
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, paddingBottom: 20, margin: 0 }}>
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
      border: highlight ? `2px solid ${PRIMARY}` : '1.5px solid #EDE5D8',
      background: highlight ? '#FFF8F0' : 'white',
      padding: '32px 28px',
      boxShadow: highlight
        ? `0 8px 40px rgba(196,98,58,0.14)`
        : '0 2px 12px rgba(0,0,0,0.05)',
      position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
          color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          padding: '5px 18px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>
          {badge}
        </div>
      )}
      <p style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
        {name}
      </p>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 42, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif' }}>
          {price === 0 ? 'Gratis' : `$${price}`}
        </span>
        {price > 0 && (
          <span style={{ fontSize: 14, color: '#9CA3AF', marginLeft: 4 }}>/mes</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px' }}>{period}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            <span style={{ color: f.included ? SAGE : '#D1D5DB', flexShrink: 0, marginTop: 1 }}>
              {f.included ? '✓' : '–'}
            </span>
            {f.text}
          </li>
        ))}
      </ul>
      <Link
        to="/login"
        style={{
          display: 'block', textAlign: 'center', padding: '14px',
          borderRadius: 14, fontWeight: 700, fontSize: 14,
          textDecoration: 'none',
          background: highlight
            ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`
            : 'white',
          color: highlight ? 'white' : PRIMARY,
          border: highlight ? 'none' : `1.5px solid ${PRIMARY}`,
          boxShadow: highlight ? `0 6px 20px rgba(196,98,58,0.28)` : 'none',
        }}
      >
        {cta}
      </Link>
    </div>
  )
}

export default function Landing() {
  const { user, loading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/hoy" replace />

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

  const plans = [
    {
      name: 'Gratis',
      price: 0,
      period: 'Para siempre sin costo',
      highlight: false,
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
      name: 'Familiar',
      price: 12.99,
      period: 'Hasta 6 cuidadores',
      highlight: true,
      badge: 'Más popular',
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
      name: 'Cuidado Total',
      price: 24.99,
      period: 'Cuidadores ilimitados',
      highlight: false,
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

  const navLinks = [
    { label: 'Funciones', href: '#funciones' },
    { label: 'Cómo funciona', href: '#como' },
    { label: 'Precios', href: '#precios' },
    { label: 'Preguntas', href: '#faq' },
  ]

  return (
    <div style={{ background: 'white', color: '#1A1A1A', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #EDE5D8',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width={36} height={36} viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="20" fill={PRIMARY} fillOpacity="0.12" />
              <circle cx="20" cy="20" r="17" fill={PRIMARY} />
              <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="13" fontWeight="800"
                fontFamily="Georgia, serif" letterSpacing="-0.5">FC</text>
              <text x="20" y="31" textAnchor="middle" dominantBaseline="middle"
                fill="white" fillOpacity="0.8" fontSize="9">♥</text>
            </svg>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
              FamiliaCerca
            </span>
          </div>

          {/* Desktop links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}
            className="landing-desktop-nav">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} style={{
                fontSize: 14, fontWeight: 500, color: '#374151',
                textDecoration: 'none', transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.target.style.color = PRIMARY}
                onMouseLeave={e => e.target.style.color = '#374151'}
              >
                {l.label}
              </a>
            ))}
            <Link to="/login" style={{
              padding: '10px 22px', borderRadius: 12,
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(196,98,58,0.28)',
            }}>
              Iniciar sesión
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{
              display: 'none', background: 'none', border: 'none', cursor: 'pointer',
              padding: 8, borderRadius: 8,
            }}
            className="landing-hamburger"
            aria-label="Menú"
          >
            <div style={{ width: 22, height: 2, background: '#374151', marginBottom: 5, borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: '#374151', marginBottom: 5, borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: '#374151', borderRadius: 2 }} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{
            borderTop: '1px solid #EDE5D8', padding: '16px 24px 24px',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'white',
          }}>
            {navLinks.map(l => (
              <a key={l.href} href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '12px 8px', fontSize: 15, fontWeight: 500,
                  color: '#374151', textDecoration: 'none', borderRadius: 8,
                }}
              >
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{
              marginTop: 8, padding: '14px', borderRadius: 14, textAlign: 'center',
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none',
            }}>
              Iniciar sesión
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: CREAM, overflow: 'hidden' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '72px 24px 0',
          display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap',
        }}>
          {/* Text */}
          <div style={{ flex: '1 1 340px', paddingBottom: 72 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: `${PRIMARY}18`, borderRadius: 20, padding: '6px 14px',
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 14 }}>💊</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, letterSpacing: '0.04em' }}>
                Cuidado familiar coordinado
              </span>
            </div>
            <h1 style={{
              fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700, color: '#1A1A1A', lineHeight: 1.15,
              margin: '0 0 20px', letterSpacing: '-0.5px',
            }}>
              Cuida a tu ser querido{' '}
              <span style={{ color: PRIMARY }}>sin perder nada</span>
            </h1>
            <p style={{
              fontSize: 'clamp(15px, 2vw, 18px)', color: '#6B7280',
              lineHeight: 1.7, margin: '0 0 36px', maxWidth: 440,
            }}>
              FamiliaCerca coordina medicamentos, rutinas y bienestar de tu familiar entre todos los cuidadores — en tiempo real, desde el celular.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/login" style={{
                padding: '16px 32px', borderRadius: 16,
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(196,98,58,0.32)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                Empezar gratis
                <span style={{ fontSize: 18 }}>→</span>
              </Link>
              <a href="#como" style={{
                padding: '16px 24px', borderRadius: 16,
                border: '1.5px solid #EDE5D8', background: 'white',
                color: '#374151', fontWeight: 600, fontSize: 15, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <span>▶</span> Ver cómo funciona
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 32, flexWrap: 'wrap' }}>
              {[
                { icon: '✓', text: 'Gratis para empezar' },
                { icon: '✓', text: 'Sin App Store' },
                { icon: '✓', text: 'Funciona en iPhone y Android' },
              ].map(b => (
                <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: SAGE, fontWeight: 700 }}>{b.icon}</span>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup with hero image */}
          <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <div style={{ position: 'relative', width: 260 }}>
              {/* Phone frame */}
              <div style={{
                width: 260, height: 520,
                background: '#1A1A1A',
                borderRadius: 44,
                padding: 10,
                boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)',
                position: 'relative',
              }}>
                {/* Notch */}
                <div style={{
                  position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                  width: 80, height: 24, background: '#1A1A1A',
                  borderRadius: '0 0 16px 16px', zIndex: 2,
                }} />
                {/* Screen */}
                <div style={{
                  width: '100%', height: '100%',
                  borderRadius: 36, overflow: 'hidden',
                  background: CREAM,
                }}>
                  <img
                    src={HERO}
                    alt="FamiliaCerca app"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
              {/* Floating badge */}
              <div style={{
                position: 'absolute', bottom: 40, right: -28,
                background: 'white', borderRadius: 16,
                padding: '12px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', gap: 10,
                minWidth: 170,
              }}>
                <span style={{ fontSize: 24 }}>💊</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>Medicamento dado</p>
                  <p style={{ margin: 0, fontSize: 11, color: SAGE }}>✓ Con foto de prueba</p>
                </div>
              </div>
              <div style={{
                position: 'absolute', top: 60, left: -32,
                background: 'white', borderRadius: 16,
                padding: '10px 14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20 }}>👨‍👩‍👧</span>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>3 cuidadores</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF' }}>en línea ahora</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section style={{ borderTop: '1px solid #EDE5D8', borderBottom: '1px solid #EDE5D8', padding: '20px 24px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap', gap: 32,
        }}>
          {[
            { icon: '🔒', text: 'Datos cifrados' },
            { icon: '📱', text: 'PWA — sin App Store' },
            { icon: '🌎', text: 'Funciona en todo el mundo' },
            { icon: '💙', text: 'Hecho por familias cuidadoras' },
          ].map(b => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{b.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{b.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 340px' }}>
            <img
              src={PROBLEMA}
              alt="El problema del cuidado familiar"
              style={{
                width: '100%', maxWidth: 480, borderRadius: 28,
                boxShadow: '0 16px 56px rgba(0,0,0,0.12)',
                display: 'block',
              }}
            />
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              El problema
            </p>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: 700, color: '#1A1A1A', lineHeight: 1.25,
              margin: '0 0 20px',
            }}>
              Cuidar a un familiar mayor es un trabajo en equipo sin coordinación
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, margin: '0 0 28px' }}>
              ¿Cuántas veces te has preguntado si tu mamá ya tomó su medicamento? ¿Si tu hermano le cambió la venda? ¿Si alguien anotó la cita del médico? Sin una herramienta común, los mensajes se pierden en WhatsApp y los errores se repiten.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: '😰', text: '\"¿Ya le diste el medicamento o lo doy yo?\"' },
                { icon: '📋', text: 'Listas en papel que nadie más puede ver' },
                { icon: '🔁', text: 'Medicamentos duplicados o saltados por falta de comunicación' },
              ].map(p => (
                <div key={p.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{
                    fontSize: 20, width: 44, height: 44, borderRadius: 12,
                    background: '#FDF0EB', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>{p.icon}</span>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0, paddingTop: 10 }}>
                    {p.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funciones" style={{ padding: '96px 24px', background: CREAM }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Funciones
            </p>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: 700, color: '#1A1A1A', margin: '0 0 16px',
            }}>
              Todo lo que necesitas en un solo lugar
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, maxWidth: 540, margin: '0 auto' }}>
              FamiliaCerca coordina a toda la familia para que ningún detalle del cuidado quede sin atender.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[
              {
                icon: '💊', color: '#FDF0EB', title: 'Control de medicamentos',
                desc: 'Registra cada medicamento con horario y dosis. Confirma cuando se dio con foto de prueba y ubicación GPS.',
              },
              {
                icon: '✅', color: '#EBF3EE', title: 'Checklist de cuidado diario',
                desc: 'Baño, comidas, ejercicio, cambios de posición — todo en una lista que toda la familia puede marcar en tiempo real.',
              },
              {
                icon: '📝', color: '#FDF8EE', title: 'Notas compartidas',
                desc: 'Deja notas de texto o voz para el siguiente cuidador. El cambio de turno nunca fue tan fácil.',
              },
              {
                icon: '📊', color: '#FDF0EB', title: 'Reportes para el médico',
                desc: 'Genera un PDF con el historial de medicamentos y cuidados para llevar a la próxima consulta.',
              },
              {
                icon: '📸', color: '#EBF3EE', title: 'Álbum de memorias',
                desc: 'Guarda fotos y momentos especiales junto al registro de salud. El cuidado también es amor.',
              },
              {
                icon: '🆘', color: '#FDECEA', title: 'Botón SOS',
                desc: 'En caso de emergencia, envía una alerta a todos los cuidadores al instante con un solo toque.',
              },
              {
                icon: '💰', color: '#FDF8EE', title: 'Gastos de salud',
                desc: 'Lleva el control de medicamentos, consultas y terapias para no perder ningún gasto deducible.',
              },
              {
                icon: '👥', color: '#EBF3EE', title: 'Múltiples cuidadores',
                desc: 'Hijos, nueras, hermanos — todos coordinados. Cada uno ve exactamente lo que necesita, con roles claros.',
              },
            ].map(f => (
              <div key={f.title} style={{
                background: 'white', borderRadius: 20,
                border: '1px solid #EDE5D8', padding: '28px 24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: f.color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 24, marginBottom: 16,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 320px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Cómo funciona
            </p>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: 700, color: '#1A1A1A', lineHeight: 1.25,
              margin: '0 0 40px',
            }}>
              Listo en 3 minutos, funciona para siempre
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                {
                  n: '1', title: 'Crea tu cuenta gratis',
                  desc: 'Regístrate con tu correo. Sin tarjeta de crédito, sin descarga en tienda de apps.',
                },
                {
                  n: '2', title: 'Agrega a tu familiar y los cuidadores',
                  desc: 'Invita a tus hermanos, pareja o cualquier persona que cuide al familiar. Cada uno tiene su propio acceso.',
                },
                {
                  n: '3', title: 'Configura medicamentos y rutinas',
                  desc: 'Carga los medicamentos con horarios. La app recuerda a cada cuidador qué toca y cuándo.',
                },
                {
                  n: '4', title: 'Coordínense en tiempo real',
                  desc: 'Cada confirmación, nota o alerta llega a todos al instante. Nunca más "¿ya lo hiciste?".',
                },
              ].map((s, i, arr) => (
                <div key={s.n} style={{ display: 'flex', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                      color: 'white', fontWeight: 800, fontSize: 15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {s.n}
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: '#EDE5D8', margin: '6px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 28 : 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '8px 0 6px' }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginTop: 40, padding: '14px 28px', borderRadius: 14,
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(196,98,58,0.28)',
            }}>
              Empezar ahora — es gratis
            </Link>
          </div>
          <div style={{ flex: '1 1 340px', display: 'flex', justifyContent: 'center' }}>
            <img
              src={COMO}
              alt="Cómo funciona FamiliaCerca"
              style={{
                width: '100%', maxWidth: 460, borderRadius: 28,
                boxShadow: '0 16px 56px rgba(0,0,0,0.12)',
              }}
            />
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section style={{ padding: '96px 24px', background: CREAM }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Testimonios
            </p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Familias que cuidan mejor juntas
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {[
              {
                name: 'María G.', role: 'Hija cuidadora, Monterrey',
                avatar: '👩',
                text: 'Antes mi hermano y yo nos peleábamos porque ninguno sabía si mi mamá ya había tomado su pastilla. Ahora con FamiliaCerca todos vemos lo mismo al mismo tiempo. ¡Nos salvó la convivencia familiar!',
              },
              {
                name: 'Roberto S.', role: 'Hijo mayor, Ciudad de México',
                avatar: '👨',
                text: 'La función de foto de prueba fue un cambio total. Ahora tenemos evidencia de cada medicamento que le damos a mi papá y podemos mostrársela al cardiólogo. El doctor quedó impresionado.',
              },
              {
                name: 'Carmen L.', role: 'Enfermera y cuidadora, Guadalajara',
                avatar: '👩‍⚕️',
                text: 'Llevo 15 años como enfermera y nunca había visto una app tan práctica para el cuidado en casa. La recomiendo a todas las familias de mis pacientes.',
              },
            ].map(t => (
              <div key={t.name} style={{
                background: 'white', borderRadius: 20,
                border: '1px solid #EDE5D8', padding: '28px 24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', marginBottom: 16 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: '#F59E0B', fontSize: 16 }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: '0 0 20px', fontStyle: 'italic' }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${PRIMARY}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section id="precios" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Precios
            </p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: '#1A1A1A', margin: '0 0 12px' }}>
              Simple y transparente
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
              Empieza gratis, actualiza cuando lo necesites. Sin contratos ni sorpresas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
            {plans.map(p => <PriceCard key={p.name} {...p} />)}
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL ── */}
      <section style={{ padding: '80px 24px', background: CREAM }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📲</div>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 3vw, 34px)',
            fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px',
          }}>
            Instálala como una app nativa
          </h2>
          <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            FamiliaCerca es una PWA — funciona como una app normal en tu celular sin pasar por la App Store ni Google Play. Sin cuota de descarga, actualizaciones automáticas.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{
              flex: '1 1 260px', background: 'white', borderRadius: 20,
              border: '1.5px solid #EDE5D8', padding: '28px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🍎</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px' }}>iPhone / Safari</h3>
              <ol style={{ textAlign: 'left', paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Abre FamiliaCerca en Safari',
                  'Toca el botón Compartir (cuadro con flecha ↑)',
                  'Desliza y elige "Agregar a inicio"',
                  '¡Listo! Ícono en tu pantalla',
                ].map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{s}</li>
                ))}
              </ol>
            </div>
            <div style={{
              flex: '1 1 260px', background: 'white', borderRadius: 20,
              border: '1.5px solid #EDE5D8', padding: '28px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px' }}>Android / Chrome</h3>
              <ol style={{ textAlign: 'left', paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Abre FamiliaCerca en Chrome',
                  'Toca el menú ⋮ (tres puntos)',
                  'Elige "Instalar aplicación" o "Agregar a pantalla de inicio"',
                  '¡Listo! Abre desde el ícono',
                ].map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              Preguntas frecuentes
            </p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Todo lo que necesitas saber
            </h2>
          </div>
          <div>
            {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: '0 24px 96px', background: 'white' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          borderRadius: 32, overflow: 'hidden',
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
          position: 'relative',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0,
          }}>
            <div style={{ flex: '1 1 320px', padding: '64px 48px' }}>
              <h2 style={{
                fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 40px)',
                fontWeight: 700, color: 'white', margin: '0 0 16px', lineHeight: 1.2,
              }}>
                Empieza a cuidar mejor hoy
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, margin: '0 0 32px' }}>
                Únete a las familias que ya coordinan el cuidado de sus seres queridos con FamiliaCerca. Gratis para siempre en el plan básico.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/login" style={{
                  padding: '16px 32px', borderRadius: 16,
                  background: 'white', color: PRIMARY,
                  fontWeight: 700, fontSize: 16, textDecoration: 'none',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  Crear cuenta gratis →
                </Link>
                <Link to="/login" style={{
                  padding: '16px 24px', borderRadius: 16,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  color: 'white', fontWeight: 600, fontSize: 15, textDecoration: 'none',
                }}>
                  Iniciar sesión
                </Link>
              </div>
            </div>
            <div style={{ flex: '1 1 300px', alignSelf: 'flex-end', overflow: 'hidden', maxHeight: 380 }}>
              <img
                src={CTA_IMG}
                alt="Familia feliz usando FamiliaCerca"
                style={{
                  width: '100%', height: 380, objectFit: 'cover',
                  objectPosition: 'center top', display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #EDE5D8', padding: '40px 24px', background: 'white' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
              FamiliaCerca
            </span>
            <span style={{ fontSize: 14, color: PRIMARY }}>♥</span>
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>Cuidado con amor</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link to="/terminos" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none' }}>Términos</Link>
            <Link to="/privacidad" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none' }}>Privacidad</Link>
            <Link to="/login" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none' }}>Iniciar sesión</Link>
          </div>
          <p style={{ fontSize: 12, color: '#D1D5DB', margin: 0 }}>
            © {new Date().getFullYear()} FamiliaCerca. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .landing-desktop-nav { display: none !important; }
          .landing-hamburger { display: flex !important; flex-direction: column; }
        }
      `}</style>
    </div>
  )
}
