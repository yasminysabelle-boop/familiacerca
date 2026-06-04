import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { geminiGenerate } from '../lib/gemini'
import Layout from '../components/Layout'
import EmptyState from '../components/EmptyState'
import LoadingButton from '../components/LoadingButton'
import MicButton from '../components/MicButton'
import { useSpeechToText } from '../hooks/useSpeechToText'

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

// Stable warm color per sender based on their first letter
const AVATAR_COLORS = [
  '#4A7C59', '#7C5CBF', '#2D86A0', '#4A7C59',
  '#C9882A', '#D63031', '#8B5E3C', '#5E86A0',
]
function avatarColor(name = '') {
  const code = name.charCodeAt(0) || 0
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

function Avatar({ name, photoUrl, size = 32 }) {
  const initial = (name ?? '?').charAt(0).toUpperCase()
  const color = avatarColor(name)
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '1.5px solid #EDE5D8',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700,
      fontSize: size * 0.4,
    }}>
      {initial}
    </div>
  )
}

const CATEGORIES = [
  { id: 'all',          emoji: '💬', label: 'Todos',        color: '#4A7C59' },
  { id: 'aviso',        emoji: '📢', label: 'Aviso',        color: '#2563EB' },
  { id: 'incidente',    emoji: '🚨', label: 'Incidente',    color: '#DC2626' },
  { id: 'evidencia',    emoji: '📷', label: 'Evidencia',    color: '#7C3AED' },
  { id: 'medicamentos', emoji: '💊', label: 'Medicamentos', color: '#16A34A' },
  { id: 'cuidados',     emoji: '📋', label: 'Cuidados',     color: '#EA580C' },
  { id: 'citas',        emoji: '📅', label: 'Citas',        color: '#0D9488' },
]

export default function Chat() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({}) // userId → { full_name, avatar_url }
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showAi, setShowAi] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [contextMsg, setContextMsg] = useState(null)   // mensaje con menú abierto
  const [pinError, setPinError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [msgCategory, setMsgCategory] = useState('general')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const longPressTimer = useRef(null)
  const longPressStartY = useRef(null)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const isOwner = user?.id === ownerId

  const { recording, interim, error: speechError, start, stop, clearError } =
    useSpeechToText(text => setInput(prev => prev ? prev + ' ' + text : text))

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

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  async function handleAiAssistant(question) {
    if (!question.trim()) return
    setAiLoading(true)
    setAiResponse('')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
    const uid = ownerId ?? user?.id
    const [
      { data: todayLogs },
      { data: recentMemories },
      { data: upcomingEvents },
      { data: recentExpenses },
    ] = await Promise.all([
      supabase.from('medication_logs').select('*, medications(name)').eq('user_id', uid).eq('log_date', today),
      supabase.from('voice_diary').select('transcription, mood').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('title, date, time').gte('date', today).order('date', { ascending: true }).limit(3),
      supabase.from('care_expenses').select('description, amount').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
    ])
    const medStatus = (todayLogs ?? []).map(l => `${l.medications?.name}: ${l.status === 'confirmed' ? 'dado' : 'pendiente'}`).join(', ')
    const memoriesText = (recentMemories ?? []).filter(m => m.transcription).map(m => `"${m.transcription.slice(0, 80)}"`).join('; ')
    const eventsText = (upcomingEvents ?? []).map(e => `${e.title} el ${e.date}`).join(', ')
    const expensesText = (recentExpenses ?? []).map(e => `${e.description}: $${e.amount}`).join(', ')
    const context = [
      medStatus && `Medicamentos hoy: ${medStatus}`,
      memoriesText && `Memorias recientes: ${memoriesText}`,
      eventsText && `Próximas citas: ${eventsText}`,
      expensesText && `Gastos recientes: ${expensesText}`,
    ].filter(Boolean).join('. ')
    const prompt = `Eres FamiliaChat, un asistente familiar cálido y práctico en español para cuidadores. Contexto actual: ${context || 'Sin datos disponibles'}. Pregunta: "${question}". Responde de forma cálida y útil en máximo 3 oraciones, sin asteriscos ni formato especial.`
    const response = await geminiGenerate(prompt, 200)
    setAiResponse(response ?? 'No pude obtener una respuesta. Verifica tu conexión e intenta de nuevo.')
    setAiLoading(false)
  }

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

  const isMe = id => id === user?.id
  const pinnedMsgs = messages.filter(m => m.is_pinned).sort((a, b) => (a.pinned_at ?? '').localeCompare(b.pinned_at ?? ''))

  return (
    <Layout>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: '#F7F3ED',
      }}>

        {/* Barra de mensajes fijados */}
        {pinnedMsgs.length > 0 && (
          <div style={{
            background: 'white', borderBottom: '1px solid #EDE5D8',
            padding: '8px 14px', flexShrink: 0,
          }}>
            {pinError && (
              <p style={{ fontSize: 11, color: '#D63031', marginBottom: 4 }}>⚠ {pinError}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {pinnedMsgs.map(msg => {
                const msgText = msg.content ?? msg.message ?? ''
                const canUnpin = isOwner || msg.user_id === user?.id
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
                    <p style={{ flex: 1, fontSize: 12, color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msgText}
                    </p>
                    {canUnpin && (
                      <button onClick={() => togglePin(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, flexShrink: 0, padding: 0 }}>
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Category filter bar */}
        <div style={{
          background: 'white', borderBottom: '1px solid #EDE5D8',
          padding: '8px 12px', flexShrink: 0,
          display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none',
                background: activeCategory === cat.id ? cat.color : '#F3F4F6',
                color: activeCategory === cat.id ? 'white' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                flexShrink: 0, whiteSpace: 'nowrap',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Overlay de menú contextual (long press) */}
        {contextMsg && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setContextMsg(null)}
          >
            <div
              style={{
                position: 'absolute', bottom: 96, left: '50%', transform: 'translateX(-50%)',
                background: 'white', borderRadius: 18, overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,0.2)', minWidth: 240,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  "{(contextMsg.content ?? contextMsg.message ?? '').slice(0, 50)}"
                </p>
              </div>
              <button
                onClick={() => togglePin(contextMsg)}
                style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: contextMsg.is_pinned ? '#D63031' : '#2D4A1E', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 18 }}>{contextMsg.is_pinned ? '📍' : '📌'}</span>
                {contextMsg.is_pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
              </button>
              <button
                onClick={() => setContextMsg(null)}
                style={{ width: '100%', padding: '12px 16px', border: 'none', background: '#F9F5F1', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {messages.length === 0 && (
            <EmptyState
              icon="💬"
              title="Sin mensajes aún"
              description="Todos los miembros de la familia pueden ver estos mensajes. ¡Sé el primero en escribir!"
            />
          )}

          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                margin: '16px 0 12px',
              }}>
                <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#9CA3AF',
                  background: '#F7F3ED', padding: '0 4px',
                }}>
                  {date}
                </span>
                <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
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
                  const catInfo = msg.category && msg.category !== 'general'
                    ? CATEGORIES.find(c => c.id === msg.category)
                    : null

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
                      {/* Avatar placeholder for alignment on "mine" side */}
                      {!mine && (
                        <div style={{ width: 32, flexShrink: 0 }}>
                          {showAvatar && (
                            <Avatar
                              name={senderName}
                              photoUrl={senderProfile?.avatar_url}
                              size={32}
                            />
                          )}
                        </div>
                      )}

                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: mine ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                      }}>
                        {/* Sender name (only for others, first bubble in group) */}
                        {showName && (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: avatarColor(senderName),
                            marginBottom: 3, marginLeft: 4,
                          }}>
                            {senderName.split(' ')[0]}
                          </span>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: '9px 14px',
                          borderRadius: mine
                            ? '18px 18px 4px 18px'
                            : '18px 18px 18px 4px',
                          background: mine
                            ? 'linear-gradient(135deg, #4A7C59, #3A6347)'
                            : 'white',
                          color: mine ? 'white' : '#1A1A1A',
                          fontSize: 14,
                          lineHeight: 1.45,
                          boxShadow: mine
                            ? '0 2px 8px rgba(74,124,89,0.25)'
                            : '0 1px 4px rgba(0,0,0,0.08)',
                          border: mine ? 'none' : '1px solid #EDE5D8',
                          wordBreak: 'break-word',
                        }}>
                          {msgText}
                        </div>

                        {/* Category badge */}
                        {catInfo && (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: catInfo.color,
                            marginTop: 2,
                            marginLeft: mine ? 0 : 4,
                            marginRight: mine ? 4 : 0,
                          }}>
                            {catInfo.emoji} {catInfo.label}
                          </span>
                        )}

                        {/* Timestamp + pin indicator */}
                        <span style={{
                          fontSize: 10, color: '#BBBBBB',
                          marginTop: 3,
                          marginLeft: mine ? 0 : 4,
                          marginRight: mine ? 4 : 0,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          {msg.is_pinned && <span style={{ fontSize: 10 }}>📌</span>}
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
        <div style={{
          padding: '10px 16px 16px',
          background: 'white',
          borderTop: '1px solid #EDE5D8',
          flexShrink: 0,
        }}>
          {/* Error / recording status */}
          {sendError && (
            <p style={{ fontSize: 12, color: '#D63031', marginBottom: 8 }}>⚠ {sendError}</p>
          )}
          {speechError && (
            <p style={{ fontSize: 12, color: '#D63031', marginBottom: 8 }}>
              ⚠ {speechError}{' '}
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
              color: interim ? '#9CA3AF' : '#D63031',
              fontWeight: interim ? 400 : 600,
            }}>
              {interim ? `🎤 ${interim}` : '🔴 Escuchando... suelta para terminar'}
            </p>
          )}

          {showAi && (
            <div style={{
              background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
              border: '1px solid #C4B5FD',
              borderRadius: 16, padding: '14px 16px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#5B21B6', margin: '0 0 10px' }}>
                ✨ Asistente familiar
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) handleAiAssistant(aiInput) }}
                  placeholder="Pregunta algo sobre el cuidado..."
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 12,
                    border: '1.5px solid #C4B5FD', fontSize: 13,
                    outline: 'none', background: 'white', fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAiAssistant(aiInput)}
                  disabled={aiLoading || !aiInput.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 12, border: 'none',
                    background: aiLoading || !aiInput.trim() ? '#C0CCC5' : 'linear-gradient(135deg, #7C5CBF, #5B21B6)',
                    color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0,
                    cursor: aiLoading || !aiInput.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {aiLoading ? '...' : 'Preguntar'}
                </button>
              </div>
              {aiResponse && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'white', borderRadius: 12,
                  border: '1px solid #DDD6FE',
                }}>
                  <p style={{ fontSize: 13, color: '#4C1D95', lineHeight: 1.6, margin: 0 }}>
                    {aiResponse}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Compact category picker */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setMsgCategory(cat.id)}
                style={{
                  padding: '3px 10px', borderRadius: 16, border: '1.5px solid',
                  borderColor: msgCategory === cat.id ? cat.color : '#EDE5D8',
                  background: msgCategory === cat.id ? cat.color : 'transparent',
                  color: msgCategory === cat.id ? 'white' : '#9CA3AF',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0, whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
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
                flex: 1, padding: '10px 14px',
                border: '1.5px solid #EDE5D8', borderRadius: 20,
                fontSize: 14, outline: 'none', resize: 'none',
                background: '#FDFAF7', lineHeight: 1.45,
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#4A7C59' }}
              onBlur={e => { e.target.style.borderColor = '#EDE5D8' }}
            />
            <MicButton recording={recording} onStart={start} onStop={stop} />
            <button
              type="button"
              onClick={() => { setShowAi(v => !v); setAiResponse('') }}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: showAi ? '#EDE9FE' : '#F3F4F6',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'background 0.15s',
              }}
              aria-label="Asistente familiar IA"
            >
              ✨
            </button>
            <LoadingButton
              type="submit"
              loading={sending}
              disabled={!input.trim() || !canEdit}
              loadingText="..."
              style={{ padding: '10px 18px', borderRadius: 20, fontSize: 13, flexShrink: 0 }}
            >
              Enviar
            </LoadingButton>
          </form>
        </div>
      </div>
    </Layout>
  )
}
