import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

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
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'long' })
}

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    loadMessages()

    const channel = supabase
      .channel('familia-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        payload => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data ?? [])
  }

  async function handleSend(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content) return

    setSending(true)
    setSendError('')
    setInput('')

    const { error } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      user_name: displayName,
      message: content,
    })

    if (error) {
      setSendError('No se pudo enviar el mensaje. Inténtalo de nuevo.')
      setInput(content)
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const grouped = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at)
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {})

  const mine = id => id === user?.id

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {Object.keys(grouped).length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-gray-500 text-sm">No hay mensajes aún.</p>
              <p className="text-gray-400 text-xs mt-1">¡Sé el primero en escribir!</p>
            </div>
          )}

          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-green-100" />
                <span className="text-xs text-gray-400 font-medium px-2">{date}</span>
                <div className="flex-1 h-px bg-green-100" />
              </div>

              <div className="space-y-2">
                {msgs.map((msg, i) => {
                  const isMe = mine(msg.user_id)
                  const prevMsg = msgs[i - 1]
                  const showName = !prevMsg || prevMsg.user_id !== msg.user_id

                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showName && !isMe && (
                          <span className="text-xs text-gray-400 font-medium mb-1 ml-1">
                            {msg.user_name}
                          </span>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-white border border-green-100 text-gray-800 rounded-bl-sm shadow-sm'
                        }`}>
                          {msg.message}
                        </div>
                        <span className={`text-xs text-gray-400 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
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

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-green-100 flex-shrink-0">
          {sendError && (
            <p className="text-xs text-red-500 mb-2 px-1">⚠ {sendError}</p>
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-medium rounded-xl text-sm transition-colors flex-shrink-0"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
