import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { geminiGenerate } from '../lib/gemini'
import { buildCareContext, CONTEXT_RULES } from '../lib/careContext'
import Layout from '../components/Layout'
import LoadingButton from '../components/LoadingButton'
import MicButton from '../components/MicButton'
import { useSpeechToText } from '../hooks/useSpeechToText'
import {
  ChevronLeft, Bell, AlertTriangle, Camera, Pill, ClipboardList, Calendar,
  MessageCircle, Sparkles, Clock, XIcon,
} from '../components/Icons'
import miloAvatarImg from '../assets/companions/milo-avatar.png'
import lunaAvatarImg from '../assets/companions/luna-avatar.png'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Identidad de avatares — variedad para distinguir personas, nunca los
// colores reservados (coral emergencia, morado IA).
const AVATAR_PALETTE = [
  { bg: '#A8E5D6', ink: '#05463D' },
  { bg: '#FBEAE4', ink: '#8A5A44' },
  { bg: '#087F70', ink: '#FFFFFF' },
  { bg: '#D99A18', ink: '#FFFFFF' },
  { bg: '#E9826E', ink: '#FFFFFF' },
]
function avatarStyle(name = '') {
  const code = name.charCodeAt(0) || 0
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

function Avatar({ name, photoUrl, size = 32 }) {
  const initial = (name ?? '?').charAt(0).toUpperCase()
  const { bg, ink } = avatarStyle(name)
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '1.5px solid rgba(51,65,85,0.08)',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: ink, fontWeight: 800,
      fontSize: size * 0.4,
    }}>
      {initial}
    </div>
  )
}

// Las 6 pills del sistema — 6 combinaciones visualmente distintas: 3 tonos
// cálidos (gold/coral/melocotón) + 3 tonos teal (claro suave / principal
// sólido / profundo suave), nunca los colores reservados de emergencia o IA.
const CATEGORY_META = {
  aviso:        { label: 'Aviso',        icon: Bell,          bg: 'rgba(217,154,24,0.15)',  ink: '#7A5510', border: 'rgba(217,154,24,0.35)',  solid: '#D99A18' },
  incidente:    { label: 'Incidente',    icon: AlertTriangle, bg: 'rgba(233,130,110,0.17)', ink: '#8C3A2A', border: 'rgba(233,130,110,0.36)', solid: '#E9826E' },
  evidencia:    { label: 'Evidencia',    icon: Camera,        bg: 'rgba(168,229,214,0.45)', ink: '#05463D', border: 'rgba(5,70,61,0.25)',     solid: '#05463D' },
  medicamentos: { label: 'Medicamentos', icon: Pill,          bg: '#087F70',                ink: '#FFFFFF', border: '#087F70',                solid: '#087F70' },
  cuidados:     { label: 'Cuidados',     icon: ClipboardList, bg: '#FBEAE4',                ink: '#8A5A44', border: 'rgba(138,90,68,0.25)',   solid: '#8A5A44' },
  citas:        { label: 'Citas',        icon: Calendar,      bg: 'rgba(5,92,81,0.14)',      ink: '#055C51', border: 'rgba(5,92,81,0.32)',     solid: '#055C51' },
}
const ALL_META = { label: 'Todos', icon: MessageCircle, bg: 'rgba(8,127,112,0.12)', ink: '#055C51', border: 'rgba(8,127,112,0.3)', solid: '#087F70' }
const FILTER_IDS = ['all', 'aviso', 'incidente', 'evidencia', 'medicamentos', 'cuidados', 'citas']
const COMPOSE_IDS = ['aviso', 'incidente', 'evidencia', 'medicamentos', 'cuidados', 'citas']

function metaFor(id) { return id === 'all' ? ALL_META : (CATEGORY_META[id] ?? ALL_META) }

export default function Chat() {
  const { user } = useAuth()
  const { ownerId, activePatientName } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [contextMsg, setContextMsg] = useState(null)
  const [pinError, setPinError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [msgCategory, setMsgCategory] = useState('general')

  // Asistente ✨ — sheet de Milo y Luna + panel de seguimiento (ask/catchup)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [assistantCard, setAssistantCard] = useState(null) // { type: 'ask'|'catchup', loading, text, error }
  const [askInput, setAskInput] = useState('')

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const longPressTimer = useRef(null)
  const longPressStartY = useRef(null)
  const lastReadAtRef = useRef(null)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const isOwner = user?.id === ownerId
  const patientFirstName = activePatientName?.split(' ')[0] || null

  const { recording, interim, error: speechError, start, stop, clearError } =
    useSpeechToText(text => setInput(prev => prev ? prev + ' ' + text : text))

  async function loadMessages() {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(msgs ?? [])

    // Fetch profiles for all unique senders
    const senderIds = [...new Set((msgs ?? []).map(m => m.user_id).filter(Boolean))]
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds)
      const map = {}
      ;(profs ?? []).forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
  }

  useEffect(() => {
    if (!ownerId) return

    loadMessages()

    const channel = supabase
      .channel(`familia-chat:${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `owner_id=eq.${ownerId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
            const senderId = payload.new.user_id
            setProfiles(prev => {
              if (prev[senderId]) return prev
              supabase
                .from('user_profiles')
                .select('id, full_name, avatar_url')
                .eq('id', senderId)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) setProfiles(p => ({ ...p, [data.id]: data }))
                })
              return prev
            })
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old?.id))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [ownerId])

  // Marca de "última visita" — se lee el valor viejo (para "Ponte al día")
  // y luego se registra esta visita. Una vez por montaje, no en cada mensaje.
  useEffect(() => {
    if (!ownerId || !user?.id) return
    ;(async () => {
      const { data } = await supabase
        .from('chat_reads')
        .select('last_read_at')
        .eq('user_id', user.id)
        .eq('owner_id', ownerId)
        .maybeSingle()
      lastReadAtRef.current = data?.last_read_at ?? null
      await supabase.from('chat_reads').upsert({
        user_id: user.id,
        owner_id: ownerId,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'user_id,owner_id' })
    })()
  }, [ownerId, user?.id])

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    if (!ownerId) { setSendError('No se pudo enviar. Inténtalo de nuevo.'); return }

    setSending(true)
    setSendError('')
    setInput('')

    const { error } = await supabase.from('chat_messages').insert({
      owner_id: ownerId,
      user_id: user.id,
      user_name: displayName,
      message: text,
      category: msgCategory,
    })

    if (error) {
      setSendError('No se pudo enviar. Inténtalo de nuevo.')
      setInput(text)
    } else {
      setMsgCategory('general')
    }

    setSending(false)
    inputRef.current?.focus()
  }

  // ── Asistente: "Preguntar a Milo y Luna" — mismo motor que CompanionChat
  // (careContext + reglas innegociables): solo hechos, sin inferir estados,
  // sin consejo médico, nombres de pila.
  async function handleAsk(question) {
    const q = question.trim()
    if (!q) return
    setAssistantCard({ type: 'ask', loading: true, text: null, error: null, question: q })
    try {
      const context = await buildCareContext(ownerId)
      // "Eres LA VOZ de Milo y Luna hablando" (no "el asistente de Milo y
      // Luna") — con la frase anterior el modelo a veces se confundía de rol
      // y saludaba a "Milo y Luna" como si fueran otra persona. Aquí hablan
      // ellos mismos, en primera persona, directo al familiar.
      const persona = 'Eres la voz conjunta de Milo y Luna, los compañeros virtuales de FamiliaCerca, hablando en primera persona directamente con un familiar dentro del chat familiar. NUNCA te dirijas a "Milo y Luna" como si fueran otra persona, ni los saludes, ni te presentes como su asistente — tú ERES ellos hablando.'
      const prompt = context
        ? `${persona} Responde en español.\n\n${CONTEXT_RULES}\n\n${context}\n\nPregunta: "${q}"`
        : `${persona} No hay contexto de cuidado disponible en este momento — si preguntan por datos específicos, dilo honestamente en vez de inventar. Responde en español, cálido y breve (2-4 oraciones). Pregunta: "${q}"`
      const response = await geminiGenerate(prompt, 250)
      if (!response) console.warn('[Chat] preguntar: geminiGenerate devolvió vacío')
      setAssistantCard({ type: 'ask', loading: false, text: response ?? 'No pude obtener una respuesta. Intenta de nuevo.', error: null, question: q })
    } catch (e) {
      console.error('[Chat] preguntar: excepción inesperada:', e)
      setAssistantCard({ type: 'ask', loading: false, text: null, error: 'No pude obtener una respuesta. Intenta de nuevo.', question: q })
    }
  }

  // ── Asistente: "Ponte al día" — resume los mensajes del chat desde la
  // última visita (chat_reads), solo con lo escrito, priorizando incidentes
  // y medicamentos sobre charla social.
  async function handleCatchUp() {
    setAssistantCard({ type: 'catchup', loading: true, text: null, error: null })
    try {
      const since = lastReadAtRef.current
      let query = supabase
        .from('chat_messages')
        .select('user_name, message, category, created_at')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
        .limit(150)
      if (since) query = query.gt('created_at', since)
      const { data: newMsgs, error: fetchError } = await query

      // Un error de consulta (RLS, red, etc.) NO debe disfrazarse de "no hay
      // mensajes nuevos" — son estados distintos y el usuario merece saber
      // cuál pasó. Antes no se revisaba `error`, así que un fallo silencioso
      // acá se veía exactamente igual que estar al día.
      if (fetchError) {
        console.error('[Chat] ponte al día: error consultando mensajes:', fetchError)
        setAssistantCard({ type: 'catchup', loading: false, text: null, error: 'No se pudo revisar el chat. Intenta de nuevo.' })
        return
      }

      if (!newMsgs?.length) {
        // Sin mensajes nuevos: mensaje fijo, NUNCA se llama a Gemini.
        setAssistantCard({ type: 'catchup', loading: false, text: 'Estás al día — no hay mensajes nuevos desde tu última visita.', error: null, upToDate: true })
        return
      }

      const lines = newMsgs.map(m => {
        const cat = m.category && m.category !== 'general' ? ` [${metaFor(m.category).label}]` : ''
        return `- ${(m.user_name ?? 'Alguien').split(' ')[0]}${cat}: ${m.message}`
      }).join('\n')

      const prompt = `Resume esta conversación del chat familiar sobre el cuidado de ${patientFirstName ?? 'un familiar'}, desde la última visita de este usuario al chat.

Reglas (innegociables):
- Resume SOLO lo escrito en los mensajes de abajo. Nunca inventes ni agregues nada que no esté ahí.
- Prioriza incidentes y medicamentos sobre charla social o mensajes de cortesía.
- Usa nombres de pila.
- Tono cálido, sin alarmismo.
- Máximo 3-4 oraciones en total.

MENSAJES:
${lines}`

      const summary = await geminiGenerate(prompt, 220)
      if (!summary) console.warn('[Chat] ponte al día: geminiGenerate devolvió vacío')
      setAssistantCard({ type: 'catchup', loading: false, text: summary ?? 'No se pudo generar el resumen. Intenta de nuevo.', error: null })
    } catch (e) {
      console.error('[Chat] ponte al día: excepción inesperada:', e)
      setAssistantCard({ type: 'catchup', loading: false, text: null, error: 'No se pudo generar el resumen. Intenta de nuevo.' })
    }
  }

  function openSheet() { setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false) }
  function pickCatchUp() { closeSheet(); handleCatchUp() }
  function pickAsk() { closeSheet(); setAskInput(''); setAssistantCard({ type: 'ask', loading: false, text: null, error: null, awaitingInput: true }) }
  function dismissAssistantCard() { setAssistantCard(null); setAskInput('') }

  function startLongPress(msg, e) {
    longPressStartY.current = e.clientY
    longPressTimer.current = setTimeout(() => {
      longPressStartY.current = null
      setContextMsg(msg)
    }, 500)
  }
  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
    longPressStartY.current = null
  }
  function checkScrollCancel(e) {
    if (longPressStartY.current === null) return
    if (Math.abs(e.clientY - longPressStartY.current) > 10) cancelLongPress()
  }

  async function togglePin(msg) {
    setPinError('')
    const alreadyPinned = msg.is_pinned
    if (!alreadyPinned) {
      const pinnedCount = messages.filter(m => m.is_pinned).length
      if (pinnedCount >= 3) { setPinError('Máximo 3 mensajes fijados.'); setContextMsg(null); return }
    }
    const { error } = await supabase.from('chat_messages').update({
      is_pinned: !alreadyPinned,
      pinned_at: alreadyPinned ? null : new Date().toISOString(),
    }).eq('id', msg.id)
    if (!error) {
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, is_pinned: !alreadyPinned, pinned_at: alreadyPinned ? null : new Date().toISOString() } : m
      ))
    }
    setContextMsg(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const filteredMessages = activeCategory === 'all'
    ? messages
    : messages.filter(m => (m.category ?? 'general') === activeCategory)

  // Group messages by date
  const grouped = filteredMessages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at)
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {})

  const isMe = id => !!id && !!user?.id && id === user.id
  const pinnedMsgs = messages.filter(m => m.is_pinned).sort((a, b) => (a.pinned_at ?? '').localeCompare(b.pinned_at ?? ''))

  return (
    <Layout>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: '#F8F4ED',
      }}>

        {/* Header propio — flecha + título + subtítulo del paciente */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px 13px',
          borderBottom: '1px solid rgba(51,65,85,0.09)',
          flexShrink: 0, background: '#F8F4ED',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: 'white', boxShadow: '0 6px 14px -8px rgba(51,65,85,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ChevronLeft size={17} color="#334155" strokeWidth={2.3} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#334155', letterSpacing: '-0.01em' }}>
              Chat familiar
            </h1>
            <p style={{
              margin: '2px 0 0', fontFamily: "'Fraunces', Georgia, serif",
              fontStyle: 'italic', fontWeight: 500, fontSize: 14, color: '#087F70',
            }}>
              {patientFirstName ? `Cuidando a ${patientFirstName}` : 'Cuidando a tu familiar'}
            </p>
          </div>
        </header>

        {/* Barra de mensajes fijados */}
        {pinnedMsgs.length > 0 && (
          <div style={{
            background: 'white', borderBottom: '1px solid rgba(51,65,85,0.09)',
            padding: '8px 14px', flexShrink: 0,
          }}>
            {pinError && (
              <p style={{ fontSize: 11, color: '#D9534F', marginBottom: 4 }}>{pinError}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {pinnedMsgs.map(msg => {
                const msgText = msg.content ?? msg.message ?? ''
                const canUnpin = isOwner || msg.user_id === user?.id
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={13} color="#94A0AD" strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    <p style={{ flex: 1, fontSize: 12, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msgText}
                    </p>
                    {canUnpin && (
                      <button onClick={() => togglePin(msg)} aria-label="Desfijar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A0AD', flexShrink: 0, padding: 0, display: 'flex' }}>
                        <XIcon size={13} color="#94A0AD" strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Barra de filtros */}
        <div style={{
          background: '#F8F4ED', borderBottom: '1px solid rgba(51,65,85,0.07)',
          padding: '9px 12px', flexShrink: 0,
          display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {FILTER_IDS.map(id => {
            const m = metaFor(id)
            const active = activeCategory === id
            const Icon = m.icon
            return (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 999,
                  border: `1.5px solid ${active ? m.solid : m.border}`,
                  background: active ? m.solid : m.bg,
                  color: active ? '#FFFFFF' : m.ink,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  flexShrink: 0, whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                <Icon size={12} color={active ? '#FFFFFF' : m.ink} strokeWidth={2.4} />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Overlay de menú contextual (long press) */}
        {contextMsg && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(51,41,74,0.4)' }}
            onClick={() => setContextMsg(null)}
          >
            <div
              style={{
                position: 'absolute', bottom: 96, left: '50%', transform: 'translateX(-50%)',
                background: 'white', borderRadius: 18, overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(51,65,85,0.24)', minWidth: 240,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.08)' }}>
                <p style={{ fontSize: 12, color: '#94A0AD', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  "{(contextMsg.content ?? contextMsg.message ?? '').slice(0, 50)}"
                </p>
              </div>
              <button
                onClick={() => togglePin(contextMsg)}
                style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 700, color: contextMsg.is_pinned ? '#D9534F' : '#087F70', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <Clock size={16} color={contextMsg.is_pinned ? '#D9534F' : '#087F70'} strokeWidth={2.2} />
                {contextMsg.is_pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
              </button>
              <button
                onClick={() => setContextMsg(null)}
                style={{ width: '100%', padding: '12px 16px', border: 'none', background: '#F8F4ED', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#94A0AD' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 14px 10px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '40px 30px', gap: 12, minHeight: 320,
            }}>
              <div style={{
                width: 68, height: 68, borderRadius: 24,
                background: '#A8E5D6', display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 2,
              }}>
                <MessageCircle size={32} color="#05463D" strokeWidth={1.8} />
              </div>
              <p style={{
                fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500,
                fontSize: 20, color: '#087F70', margin: 0, maxWidth: 240,
              }}>
                Aquí la familia se mantiene cerca.
              </p>
              <p style={{ fontSize: 14, color: '#6B7686', margin: 0 }}>
                Escribe el primer mensaje.
              </p>
            </div>
          )}

          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 12px' }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, color: '#94A0AD',
                  background: 'rgba(51,65,85,0.07)', padding: '5px 14px', borderRadius: 999,
                }}>
                  {date}
                </span>
              </div>

              {/* Message bubbles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {msgs.map((msg, i) => {
                  const mine = isMe(msg.user_id)
                  const prevMsg = msgs[i - 1]
                  const nextMsg = msgs[i + 1]
                  const showAvatar = !mine && (!nextMsg || nextMsg.user_id !== msg.user_id)
                  const showName = !mine && (!prevMsg || prevMsg.user_id !== msg.user_id)
                  const senderProfile = profiles[msg.user_id]
                  const senderName = senderProfile?.full_name ?? msg.user_name ?? 'Familiar'
                  const msgText = msg.content ?? msg.message ?? ''
                  const catInfo = msg.category && msg.category !== 'general' ? metaFor(msg.category) : null
                  const CatIcon = catInfo?.icon

                  return (
                    <div
                      key={msg.id}
                      onPointerDown={e => startLongPress(msg, e)}
                      onPointerMove={checkScrollCancel}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onContextMenu={e => { e.preventDefault(); setContextMsg(msg) }}
                      style={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        gap: 8,
                        marginBottom: (!nextMsg || nextMsg.user_id !== msg.user_id) ? 8 : 2,
                        userSelect: 'none',
                      }}
                    >
                      {!mine && (
                        <div style={{ width: 30, flexShrink: 0 }}>
                          {showAvatar && <Avatar name={senderName} photoUrl={senderProfile?.avatar_url} size={30} />}
                        </div>
                      )}

                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: mine ? 'flex-end' : 'flex-start',
                        maxWidth: '78%',
                      }}>
                        {showName && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7686', marginBottom: 3, marginLeft: 4 }}>
                            {senderName.split(' ')[0]}
                          </span>
                        )}

                        {catInfo && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
                            background: catInfo.bg, color: catInfo.ink,
                            margin: mine ? '0 4px 3px 0' : '0 0 3px 4px',
                          }}>
                            <CatIcon size={10} color={catInfo.ink} strokeWidth={2.6} />
                            {catInfo.label}
                          </span>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                          background: mine ? 'linear-gradient(148deg, #12A18C 0%, #0A8072 46%, #055C51 100%)' : 'white',
                          color: mine ? 'white' : '#334155',
                          fontSize: 14.5,
                          lineHeight: 1.48,
                          boxShadow: mine ? '0 6px 14px -8px rgba(5,92,81,0.55)' : '0 6px 14px -8px rgba(51,65,85,0.35)',
                          wordBreak: 'break-word',
                        }}>
                          {msgText}
                        </div>

                        {/* Timestamp + pin indicator */}
                        <span style={{
                          fontSize: 10.5, color: '#94A0AD',
                          marginTop: 3,
                          marginLeft: mine ? 0 : 4,
                          marginRight: mine ? 4 : 0,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {msg.is_pinned && <Clock size={9} color="#94A0AD" strokeWidth={2.4} />}
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '8px 12px 16px', background: '#F8F4ED', flexShrink: 0 }}>
          {sendError && (
            <p style={{ fontSize: 12, color: '#D9534F', marginBottom: 8 }}>{sendError}</p>
          )}
          {speechError && (
            <p style={{ fontSize: 12, color: '#D9534F', marginBottom: 8 }}>
              {speechError}{' '}
              <button
                onClick={clearError}
                style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit' }}
              >
                Cerrar
              </button>
            </p>
          )}
          {recording && (
            <p style={{
              fontSize: 12, marginBottom: 8, fontStyle: 'italic',
              color: interim ? '#6B7686' : '#D9534F',
              fontWeight: interim ? 400 : 700,
            }}>
              {interim ? interim : 'Grabando... toca el botón para detener'}
            </p>
          )}

          {/* Panel del asistente — "Preguntar" o "Ponte al día" */}
          {assistantCard && (
            <div style={{
              background: 'linear-gradient(178deg, #EFEDFC 0%, #FFFFFF 60%)',
              border: '1px solid rgba(117,102,216,0.22)',
              borderRadius: 18, padding: '14px 16px', marginBottom: 12,
              boxShadow: '0 6px 14px -8px rgba(117,102,216,0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ display: 'flex' }}>
                  <img src={miloAvatarImg} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', marginRight: -8, border: '2px solid #EFEDFC' }} />
                  <img src={lunaAvatarImg} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '2px solid #EFEDFC' }} />
                </span>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: '#5B4BC4', margin: 0, flex: 1 }}>
                  {assistantCard.type === 'catchup' ? 'Ponte al día' : 'Preguntar a Milo y Luna'}
                </p>
                <button
                  onClick={dismissAssistantCard}
                  aria-label="Cerrar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A0AD', display: 'flex', padding: 0 }}
                >
                  <XIcon size={15} color="#94A0AD" strokeWidth={2.2} />
                </button>
              </div>

              {assistantCard.type === 'ask' && assistantCard.awaitingInput && !assistantCard.loading && !assistantCard.text && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={askInput}
                    onChange={e => setAskInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAsk(askInput) }}
                    placeholder={`Pregunta sobre el cuidado de ${patientFirstName ?? 'tu familiar'}...`}
                    autoFocus
                    style={{
                      flex: 1, padding: '9px 13px', borderRadius: 12,
                      border: '1.5px solid rgba(117,102,216,0.35)', fontSize: 13.5,
                      outline: 'none', background: 'white', fontFamily: 'inherit', color: '#334155',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAsk(askInput)}
                    disabled={!askInput.trim()}
                    style={{
                      padding: '9px 16px', borderRadius: 12, border: 'none',
                      background: askInput.trim() ? 'linear-gradient(160deg, #9E8FEF, #7566D8)' : '#D9D6EE',
                      color: 'white', fontWeight: 700, fontSize: 12.5, flexShrink: 0,
                      cursor: askInput.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Preguntar
                  </button>
                </div>
              )}

              {assistantCard.loading && (
                <p style={{ fontSize: 13, color: '#5B4BC4', margin: 0, fontStyle: 'italic' }}>Pensando...</p>
              )}

              {assistantCard.error && (
                <p style={{ fontSize: 13, color: '#D9534F', margin: 0 }}>{assistantCard.error}</p>
              )}

              {assistantCard.text && (
                <div style={{ marginTop: assistantCard.question ? 10 : 0 }}>
                  {assistantCard.question && (
                    <p style={{ fontSize: 12, color: '#6B7686', margin: '0 0 8px', fontStyle: 'italic' }}>
                      "{assistantCard.question}"
                    </p>
                  )}
                  <div style={{ padding: '11px 13px', background: 'white', borderRadius: 12, border: '1px solid rgba(117,102,216,0.18)' }}>
                    <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.58, margin: 0 }}>
                      {assistantCard.text}
                    </p>
                  </div>
                  {assistantCard.type === 'catchup' && !assistantCard.upToDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11, fontWeight: 700, color: '#5B4BC4', opacity: 0.85 }}>
                      <Sparkles size={11} color="#5B4BC4" strokeWidth={2.2} />
                      Solo tú ves este resumen
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Floating card wrapping picker + form */}
          <div style={{
            background: 'white', borderRadius: 20,
            boxShadow: '0 6px 14px -8px rgba(51,65,85,0.35)',
            padding: '10px 12px 10px',
          }}>
            {/* Compact category picker */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {COMPOSE_IDS.map(id => {
                const m = metaFor(id)
                const selected = msgCategory === id
                const Icon = m.icon
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMsgCategory(selected ? 'general' : id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 999,
                      border: `1.5px solid ${selected ? m.solid : m.border}`,
                      background: selected ? m.solid : m.bg,
                      color: selected ? '#FFFFFF' : m.ink,
                      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      flexShrink: 0, whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={11} color={selected ? '#FFFFFF' : m.ink} strokeWidth={2.6} />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                style={{
                  flex: 1, padding: '11px 16px',
                  border: '1px solid rgba(51,65,85,0.12)', borderRadius: 999,
                  fontSize: 14, outline: 'none', resize: 'none',
                  background: '#F8F4ED', lineHeight: 1.4,
                  fontFamily: 'inherit', color: '#334155',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#087F70' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(51,65,85,0.12)' }}
              />
              <MicButton recording={recording} onStart={start} onStop={stop} />
              <button
                type="button"
                onClick={openSheet}
                style={{
                  width: 42, height: 42, borderRadius: '50%', border: 'none',
                  background: 'linear-gradient(160deg, #9E8FEF, #7566D8)',
                  boxShadow: '0 6px 14px -6px rgba(117,102,216,0.55)',
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.12s',
                }}
                aria-label="Abrir asistente de Milo y Luna"
              >
                <Sparkles size={18} color="white" strokeWidth={2} />
              </button>
              <LoadingButton
                type="submit"
                loading={sending}
                disabled={!input.trim() || !canEdit}
                loadingText="..."
                style={{
                  padding: '11px 18px', borderRadius: 999, fontSize: 13, flexShrink: 0,
                  background: '#087F70', boxShadow: sending || !input.trim() ? 'none' : '0 6px 14px -6px rgba(8,127,112,0.5)',
                }}
              >
                Enviar
              </LoadingButton>
            </form>
          </div>
        </div>

        {/* Sheet de Milo y Luna */}
        {sheetOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(38,32,74,0.4)', display: 'flex', alignItems: 'flex-end' }}
            onClick={closeSheet}
          >
            <div
              style={{
                width: '100%', background: 'linear-gradient(178deg, #EFEDFC 0%, #FFFFFF 34%)',
                borderRadius: '28px 28px 0 0', padding: '10px 20px calc(24px + env(safe-area-inset-bottom))',
                boxShadow: '0 -14px 34px -12px rgba(75,60,160,0.4)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 38, height: 4, borderRadius: 4, background: 'rgba(117,102,216,0.3)', margin: '6px auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ display: 'flex' }}>
                  <img src={miloAvatarImg} alt="Milo" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: -10, border: '2.5px solid #EFEDFC' }} />
                  <img src={lunaAvatarImg} alt="Luna" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #EFEDFC' }} />
                </span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#5B4BC4' }}>Milo y Luna</h2>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: '#6B7686' }}>
                    Tus compañeros para el cuidado de {patientFirstName ?? 'tu familiar'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={pickCatchUp}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', background: 'white', border: '1px solid rgba(117,102,216,0.16)',
                  borderRadius: 18, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 10,
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, background: '#EFEDFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={19} color="#5B4BC4" strokeWidth={2} />
                </span>
                <span>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: '#334155', margin: '0 0 2px' }}>Ponte al día</p>
                  <p style={{ fontSize: 12, color: '#6B7686', margin: 0, lineHeight: 1.35 }}>Te resumimos lo que pasó en el chat desde tu última visita.</p>
                </span>
              </button>

              <button
                type="button"
                onClick={pickAsk}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', background: 'white', border: '1px solid rgba(117,102,216,0.16)',
                  borderRadius: 18, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, background: '#EFEDFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={19} color="#5B4BC4" strokeWidth={2} />
                </span>
                <span>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: '#334155', margin: '0 0 2px' }}>Preguntar a Milo y Luna</p>
                  <p style={{ fontSize: 12, color: '#6B7686', margin: 0, lineHeight: 1.35 }}>
                    Escribe lo que quieras saber sobre el cuidado de {patientFirstName ?? 'tu familiar'}.
                  </p>
                </span>
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
