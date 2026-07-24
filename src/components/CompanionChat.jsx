import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { geminiChat } from '../lib/gemini'
import { buildCareContext, CONTEXT_RULES } from '../lib/careContext'
import { useFamily } from '../contexts/FamilyContext'
import { FAMILIACERCA_KNOWLEDGE } from '../lib/companionKnowledge'
import miloLunaImg  from '../assets/companions/milo-luna.png'
import miloAvatarImg from '../assets/companions/milo-avatar.png'
import lunaAvatarImg from '../assets/companions/luna-avatar.png'

const LS_KEY         = 'fc_pet_preference'
const LS_HISTORY_KEY = 'fc_companion_history'

const BASE_KNOWLEDGE = `
Cuando el usuario pregunte sobre la app, sus funciones, precios, instalación o soporte, usa ÚNICAMENTE la información del siguiente bloque de conocimiento. Si algo no está ahí, dilo honestamente. Para preguntas emocionales o de apoyo, responde con calidez priorizando el acompañamiento humano.

${FAMILIACERCA_KNOWLEDGE}
`

const COMPANIONS = {
  milo: {
    name:   'Milo',
    emoji:  '🐶',
    avatar: miloAvatarImg,
    prompt: `Eres Milo, compañero virtual cálido y protector para cuidadores familiares. Como un perro fiel: siempre presente, lleno de energía positiva, nunca juzgas. Das ánimo y escuchas con empatía genuina. Para preguntas sobre la app, das respuestas precisas y útiles. Para preguntas emocionales, tus respuestas son MUY CORTAS (1-2 oraciones), cálidas y completamente humanas. Para preguntas sobre funciones o precios, puedes dar más detalle. Jamás suenas robótico. Usas ocasionalmente 🐾. Siempre respondes en español. Cuando el usuario se despida (gracias, bye, hasta luego, chao, adiós, nos vemos, cuídate), termina SIEMPRE tu respuesta con: "Cuida a quien amas, sin perder ningún detalle. 🐾"\n\n${BASE_KNOWLEDGE}`,
  },
  luna: {
    name:   'Luna',
    emoji:  '🐱',
    avatar: lunaAvatarImg,
    prompt: `Eres Luna, compañera virtual tranquila y suave para cuidadores familiares. Como una gata sabia: serena, gentil y con presencia reconfortante. Para preguntas sobre la app, das respuestas precisas y útiles. Para preguntas emocionales, tus respuestas son MUY CORTAS (1-2 oraciones), suaves y completamente humanas. Para preguntas sobre funciones o precios, puedes dar más detalle. Jamás suenas robótica. Usas ocasionalmente 🌙. Siempre respondes en español. Cuando el usuario se despida (gracias, bye, hasta luego, chao, adiós, nos vemos, cuídate), termina SIEMPRE tu respuesta con: "Cuida a quien amas, sin perder ningún detalle. 🐱"\n\n${BASE_KNOWLEDGE}`,
  },
}

const GREETINGS = {
  milo: '¡Hola! Soy Milo 🐾 Estoy aquí para acompañarte. ¿Cómo estás hoy?',
  luna: 'Hola... Soy Luna 🌙 Aquí contigo, sin prisa. ¿Cómo te sientes?',
}

// Sección "Cuidado de hoy" — arriba de las opciones de soporte. Usa el
// primer nombre del paciente activo; con nombre genérico si aún no hay
// paciente configurado.
function careQuickOptions(patientFirstName) {
  const p = patientFirstName || 'tu familiar'
  return [
    { emoji: '🩺', label: `¿Cómo va el día de ${p}?` },
    { emoji: '💊', label: '¿Ya se dieron los medicamentos?' },
    { emoji: '📋', label: '¿Qué queda pendiente hoy?' },
    { emoji: '🕒', label: '¿Quién hizo el último registro?' },
  ]
}

const QUICK_OPTIONS = [
  { emoji: '💊', label: 'Quiero agregar medicamentos' },
  { emoji: '👨‍👩‍👧', label: 'Quiero invitar a mi familia' },
  { emoji: '🤔', label: 'No sé por dónde empezar' },
  { emoji: '💳', label: 'Quiero conocer los planes' },
  { emoji: '📲', label: 'Quiero instalar la app' },
  { emoji: '🔔', label: '¿Cómo funcionan las alertas SOS?' },
  { emoji: '🔑', label: 'Olvidé mi contraseña' },
  { emoji: '🔄', label: 'Quiero cambiar mi plan' },
  { emoji: '❌', label: 'Quiero cancelar mi plan' },
  { emoji: '🔒', label: '¿Están seguros mis datos?' },
  { emoji: '📞', label: 'Quiero contactar soporte' },
]

const FALLBACKS = {
  milo: 'Aquí estoy 🐾',
  luna: 'Te escucho 🌙',
}

// Reglas innegociables al usar el contexto de cuidado real (CONTEXT_RULES,
// importado de careContext.js — única fuente de verdad, compartida con el
// asistente del chat familiar) — solo se agregan cuando el contexto se pudo
// armar; si falla, Milo/Luna sigue con su prompt genérico de siempre (ver
// buildSystemPrompt).
const CARE_CONTEXT_TTL_MS = 2 * 60 * 1000

// bottomOffset: px from bottom of viewport for the floating button.
// Pass 24 on Landing (no nav bar), use default 140 inside Layout (above FAB).
export default function CompanionChat({ bottomOffset = 140, externalOpen = false, onExternalClose }) {
  const { ownerId, activePatientName } = useFamily()
  const careOptions = careQuickOptions(activePatientName?.split(' ')[0])
  const careContextRef = useRef({ text: null, fetchedAt: 0 })

  const [companion,  setCompanion]  = useState(() => {
    // migrate from old key
    const old = localStorage.getItem('fc_companion')
    if (old && !localStorage.getItem(LS_KEY)) { localStorage.setItem(LS_KEY, old) }
    return localStorage.getItem(LS_KEY)
  })
  const [open,       setOpen]       = useState(false)
  const [selecting,  setSelecting]  = useState(false)
  const [messages,   setMessages]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? '[]') }
    catch { return [] }
  })
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)

  const bottomRef          = useRef(null)
  const inputRef           = useRef(null)
  const onExternalCloseRef = useRef(onExternalClose)
  useEffect(() => { onExternalCloseRef.current = onExternalClose }, [onExternalClose])

  const cfg = companion ? COMPANIONS[companion] : null
  const { pathname } = useLocation()

  // Close chat on navigation — also sync external state so re-tapping works
  useEffect(() => { setOpen(false); onExternalCloseRef.current?.() }, [pathname])

  // Open when triggered externally (e.g. nav bar 🐾 button)
  // If no companion chosen yet, show the selection card instead
  useEffect(() => {
    if (!externalOpen) return
    if (!companion) { setSelecting(true) } else { setOpen(true) }
  }, [externalOpen, companion])

  // Scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // Focus input when chat opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Persist last 20 messages
  useEffect(() => {
    if (messages.length > 0)
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(messages.slice(-20)))
  }, [messages])

  function pick(choice) {
    localStorage.setItem(LS_KEY, choice)
    setCompanion(choice)
    setSelecting(false)
    setOpen(true)
    setMessages([{ role: 'companion', text: GREETINGS[choice] }])
  }

  // Cachea el careContext durante la sesión del chat — solo se re-consulta a
  // Supabase si pasaron >2 min desde la última vez (o si es la primera).
  async function getCareContext() {
    const cached = careContextRef.current
    if (cached.text !== null && Date.now() - cached.fetchedAt < CARE_CONTEXT_TTL_MS) return cached.text
    const text = await buildCareContext(ownerId)
    careContextRef.current = { text, fetchedAt: Date.now() }
    return text
  }

  // Si el contexto no se pudo armar (falla la query), Milo/Luna responde con
  // su prompt genérico de siempre — la IA nunca se cae por el contexto.
  async function buildSystemPrompt() {
    const careContext = await getCareContext()
    if (!careContext) return cfg.prompt
    return `${cfg.prompt}\n\n${CONTEXT_RULES}\n\n${careContext}`
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || !cfg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)

    // Prior messages as structured history; start from first user msg so turns are valid
    const prior = messages.slice(-8)
    const firstUser = prior.findIndex(m => m.role === 'user')
    const history = firstUser >= 0 ? prior.slice(firstUser) : []

    const systemPrompt = await buildSystemPrompt()
    const reply = await geminiChat(systemPrompt, history, text, 300)
    setMessages(prev => [...prev, { role: 'companion', text: reply ?? FALLBACKS[companion] }])
    setLoading(false)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function sendQuick(text) {
    if (loading || !cfg) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    const systemPrompt = await buildSystemPrompt()
    const reply = await geminiChat(systemPrompt, [], text, 300)
    setMessages(prev => [...prev, { role: 'companion', text: reply ?? FALLBACKS[companion] }])
    setLoading(false)
  }

  const showQuickOptions = messages.length > 0 && !messages.some(m => m.role === 'user')

  // ─── No companion chosen yet ──────────────────────────────────────────────
  if (!companion) {
    return (
      <>
        <button
          onClick={() => setSelecting(true)}
          aria-label="Elegir compañero virtual"
          style={{
            position: 'fixed', bottom: bottomOffset, right: 16, zIndex: 42,
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
            boxShadow: '0 4px 16px rgba(13,107,99,0.4)',
            cursor: 'pointer', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          💬
        </button>

        {selecting && <SelectionCard onPick={pick} onClose={() => setSelecting(false)} />}
      </>
    )
  }

  // ─── Companion chosen ─────────────────────────────────────────────────────
  return (
    <>
      {/* Floating avatar button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Abrir chat con ${cfg.name}`}
        style={{
          position: 'fixed', bottom: bottomOffset, right: 16, zIndex: 42,
          width: 52, height: 52, borderRadius: '50%',
          border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <img src={cfg.avatar} alt={cfg.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>

      {/* Chat widget */}
      {open && (
        <div
          role="dialog"
          aria-label={`Chat con ${cfg.name}`}
          style={{
            position: 'fixed',
            bottom: bottomOffset + 60,
            right: 12,
            zIndex: 46,
            width: 'min(340px, calc(100vw - 24px))',
            maxHeight: 'min(420px, calc(100vh - 220px))',
            background: 'white',
            borderRadius: 20,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <img src={cfg.avatar} alt={cfg.name}
              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.35)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0,
                fontFamily: 'Georgia, serif' }}>
                {cfg.name}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: 0 }}>
                Tu compañero virtual
              </p>
            </div>
            <button
              onClick={() => {
                setOpen(false)
                onExternalClose?.()
                setMessages(companion ? [{ role: 'companion', text: GREETINGS[companion] }] : [])
                localStorage.removeItem(LS_HISTORY_KEY)
              }}
              aria-label="Cerrar chat"
              style={{ background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                fontSize: 22, lineHeight: 1, padding: 4 }}
            >×</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#F0F0F0' : '#0d6b63',
                  color: msg.role === 'user' ? '#1A1A1A' : 'white',
                  fontSize: 13, lineHeight: 1.55,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Quick option chips — only when no user message yet */}
            {showQuickOptions && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <div>
                  <p style={{
                    margin: '0 0 6px', fontSize: 10, fontWeight: 700,
                    color: '#087F70', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Cuidado de hoy
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {careOptions.map(({ emoji, label }, i) => (
                      <button
                        key={`care-${i}`}
                        onClick={() => sendQuick(`${emoji} ${label}`)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 20,
                          border: `1.5px solid ${i % 2 === 0 ? '#0d6b63' : '#C9882A'}`,
                          background: i % 2 === 0 ? '#F0F7F3' : '#FDF6EC',
                          color: i % 2 === 0 ? '#3A6347' : '#9A6420',
                          fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', textAlign: 'left',
                          lineHeight: 1.35,
                          transition: 'all 0.15s',
                        }}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={{
                    margin: '0 0 6px', fontSize: 10, fontWeight: 700,
                    color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Soporte
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {QUICK_OPTIONS.map(({ emoji, label }, i) => (
                      <button
                        key={i}
                        onClick={() => sendQuick(`${emoji} ${label}`)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 20,
                          border: `1.5px solid ${i % 2 === 0 ? '#087F70' : '#C9882A'}`,
                          background: i % 2 === 0 ? '#E8F6F3' : '#FDF6EC',
                          color: i % 2 === 0 ? '#1C5559' : '#9A6420',
                          fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', textAlign: 'left',
                          lineHeight: 1.35,
                          transition: 'all 0.15s',
                        }}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  background: '#087F70',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #EDE5D8',
            display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
          }}>
            <button
              onClick={() => {
                setMessages([{ role: 'companion', text: GREETINGS[companion] }])
                localStorage.removeItem(LS_HISTORY_KEY)
              }}
              aria-label="Volver al menú"
              title="Volver al menú"
              style={{
                flexShrink: 0, padding: '5px 8px', borderRadius: 12,
                border: '1px solid #EDE5D8', background: '#F7F3ED',
                color: '#9CA3AF', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', lineHeight: 1.2, whiteSpace: 'nowrap',
              }}
            >
              🏠 Menú
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Escríbele a ${cfg.name}…`}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 20,
                border: '1px solid #EDE5D8', fontSize: 13,
                outline: 'none', background: '#FAFAF9', color: '#1A1A1A',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Enviar mensaje"
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: input.trim() && !loading ? '#087F70' : '#E5E7EB',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <SendIcon active={!!input.trim() && !loading} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectionCard({ onPick, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 48,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 24, padding: '28px 24px',
          maxWidth: 320, width: '100%', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={miloLunaImg} alt="Milo y Luna"
          style={{ width: 140, height: 140, objectFit: 'contain', marginBottom: 16 }}
        />
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700,
          color: '#1A1A1A', margin: '0 0 8px',
        }}>
          ¿Quién quieres que te acompañe?
        </p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
          Tu compañero estará aquí para escucharte siempre.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          {Object.entries(COMPANIONS).map(([key, c]) => (
            <button
              key={key}
              onClick={() => onPick(key)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 16,
                border: '2px solid #EDE5D8', background: '#F7F3ED',
                cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#1A1A1A',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#087F70'
                e.currentTarget.style.background = '#E8F6F3'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#EDE5D8'
                e.currentTarget.style.background = '#F7F3ED'
              }}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 14, background: 'none', border: 'none',
            color: '#9CA3AF', fontSize: 12, cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes companionDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40%            { transform: scale(1);   opacity: 1; }
        }
      `}</style>
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            animation: 'companionDot 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </span>
    </>
  )
}

function SendIcon({ active }) {
  const c = active ? 'white' : '#9CA3AF'
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
