import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import imgFamilia from '../assets/images/splash-familia.png'

const LS_KEY = 'fc_permissions_asked'

const ITEMS = [
  {
    emoji: '📷',
    title: 'Cámara',
    desc: 'Para tomar fotos de medicamentos, citas y momentos del cuidado',
  },
  {
    emoji: '🎤',
    title: 'Micrófono',
    desc: 'Para el diario de voz y notas de audio del cuidado',
  },
  {
    emoji: '🖼️',
    title: 'Galería',
    desc: 'Para subir fotos existentes al álbum familiar',
  },
]

export default function Permissions() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [status, setStatus] = useState('idle') // idle | requesting | granted | denied

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) {
      navigate(next, { replace: true })
    }
  }, [])

  function markAndGo() {
    localStorage.setItem(LS_KEY, '1')
    navigate(next, { replace: true })
  }

  async function handleAllow() {
    setStatus('requesting')

    if (!navigator.mediaDevices?.getUserMedia) {
      markAndGo()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach(t => t.stop())
      localStorage.setItem(LS_KEY, '1')
      setStatus('granted')
      setTimeout(() => navigate(next, { replace: true }), 900)
    } catch (err) {
      localStorage.setItem(LS_KEY, '1')
      if (err.name === 'NotFoundError') {
        // No camera/mic on device — not a real denial, just proceed
        navigate(next, { replace: true })
      } else {
        setStatus('denied')
      }
    }
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0A0A0A',
    }}>
      {/* Background photo */}
      <img
        src={imgFamilia}
        alt="Familia"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
        }}
      />
      {/* Gradient — zona superior consistentemente oscura (0.82-0.86) donde
          vive el header del logo, sin importar la foto de fondo (más cálida
          y luminosa que la de Login.jsx); se aclara en el medio porque ahí
          la card ya trae su propio fondo casi opaco, y vuelve a oscurecer
          hacia abajo para la nota de pie ("Tus datos están cifrados..."). */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.82) 18%, rgba(0,0,0,0.48) 40%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.78) 100%)',
      }} />

      {/* Logo — anclado en un bloque fijo arriba, igual que Login.jsx, para
          que su posición nunca dependa de la altura de la card de abajo
          (idle/granted/denied tienen alturas distintas) */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 56, paddingBottom: 24,
      }}>
        <Logo variant="light" size={32} showWordmark />
      </div>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 20px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ── Granted state ── */}
          {status === 'granted' && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '40px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                ¡Permisos activados!
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                Todo listo para cuidar a tu familiar.
              </p>
            </div>
          )}

          {/* ── Denied state ── */}
          {status === 'denied' && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '28px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                  Permisos no activados
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  Bloqueaste el acceso. Puedes activarlos más tarde desde la configuración de tu navegador.
                </p>
              </div>

              <div style={{
                background: '#F9F5F1', borderRadius: 14,
                padding: '14px 16px', marginBottom: 20,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Cómo habilitarlos
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📱</span>
                    <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      <strong>iPhone / Safari:</strong> Ajustes → Safari → Cámara y Micrófono → Permitir
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🌐</span>
                    <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      <strong>Chrome / Android:</strong> Toca el candado 🔒 en la barra de dirección → Permisos
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={markAndGo}
                style={{
                  width: '100%', padding: '13px',
                  background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  borderRadius: 14, border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(8,127,112,0.3)',
                }}
              >
                Continuar sin permisos →
              </button>
            </div>
          )}

          {/* ── Idle / requesting state ── */}
          {(status === 'idle' || status === 'requesting') && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '28px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(8,127,112,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', fontSize: 26,
                }}>
                  🔓
                </div>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 19, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
                  Necesitamos tu permiso
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Para ofrecerte la mejor experiencia de cuidado, necesitamos acceso a:
                </p>
              </div>

              {/* Permission items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {ITEMS.map(item => (
                  <div key={item.title} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '12px 14px',
                    background: 'white', borderRadius: 14,
                    border: '1px solid #EDE5D8',
                  }}>
                    <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>
                      {item.emoji}
                    </span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Privacy note */}
              <p style={{
                fontSize: 11, color: '#9CA3AF', textAlign: 'center',
                lineHeight: 1.6, marginBottom: 18,
              }}>
                🔒 Tus permisos son solo para esta app. Nunca accedemos a tu cámara o micrófono sin que tú lo actives.
              </p>

              {/* Allow button */}
              <button
                onClick={handleAllow}
                disabled={status === 'requesting'}
                style={{
                  width: '100%', padding: '14px',
                  background: status === 'requesting'
                    ? '#D4C4B8'
                    : 'linear-gradient(135deg, #0d6b63, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 15,
                  borderRadius: 16, border: 'none',
                  cursor: status === 'requesting' ? 'not-allowed' : 'pointer',
                  boxShadow: status === 'requesting' ? 'none' : '0 8px 24px rgba(8,127,112,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {status === 'requesting' ? 'Solicitando permisos...' : 'Permitir acceso'}
              </button>

              {/* Skip link */}
              <button
                onClick={markAndGo}
                style={{
                  display: 'block', width: '100%', marginTop: 12,
                  padding: '10px', background: 'none', border: 'none',
                  fontSize: 13, color: '#9CA3AF', cursor: 'pointer',
                }}
              >
                Ahora no
              </button>
            </div>
          )}
        </div>

        <p style={{
          marginTop: 20, textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
        }}>
          Tus datos están cifrados y son solo tuyos.
        </p>
      </div>
    </div>
  )
}
