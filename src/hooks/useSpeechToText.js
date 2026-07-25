import { useCallback, useRef, useState } from 'react'

export function useSpeechToText(onResult) {
  const [recording, setRecording] = useState(false)
  const [interim,   setInterim]   = useState('')
  const [error,     setError]     = useState('')

  const recRef      = useRef(null)
  const stoppedRef  = useRef(true)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function makeRec() {
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang            = 'es-MX'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    // Texto final acumulado de ESTA sesión de reconocimiento, reconstruido
    // completo en cada evento — Chrome en modo continuo a veces "revisa" un
    // resultado ya marcado isFinal (lo alarga) en vez de agregar uno nuevo;
    // tratar cada isFinal como un fragmento independiente duplicaba esa
    // revisión. Aquí se recalcula el total y solo se emite la diferencia.
    let finalizedSoFar = ''

    rec.onresult = e => {
      let sessionFinal = ''
      let live = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          sessionFinal += (sessionFinal ? ' ' : '') + t.trim()
        } else {
          live += t
        }
      }
      if (sessionFinal && sessionFinal !== finalizedSoFar) {
        const delta = sessionFinal.startsWith(finalizedSoFar)
          ? sessionFinal.slice(finalizedSoFar.length).trim()
          : sessionFinal
        finalizedSoFar = sessionFinal
        if (delta) onResultRef.current(delta)
      }
      setInterim(live)
    }

    rec.onerror = e => {
      if (e.error === 'not-allowed') {
        setError('Micrófono bloqueado. Actívalo en la configuración del navegador.')
        stoppedRef.current = true
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('No se pudo transcribir. Inténtalo de nuevo.')
      }
      setInterim('')
    }

    rec.onend = () => {
      setInterim('')
      if (!stoppedRef.current) {
        // no-speech or other transient termination — restart transparently
        try {
          const next = makeRec()
          recRef.current = next
          next.start()
        } catch {
          stoppedRef.current = true
          setRecording(false)
        }
      } else {
        setRecording(false)
      }
    }

    return rec
  }

  const start = useCallback(() => {
    if (!supported) {
      setError('Tu navegador no soporta esta función. Usa Chrome para esta función.')
      return
    }
    setError('')
    setInterim('')
    stoppedRef.current = false
    const rec = makeRec()
    recRef.current = rec
    rec.start()
    setRecording(true)
  }, [supported])

  const stop = useCallback(() => {
    stoppedRef.current = true
    recRef.current?.stop()
    recRef.current = null
    setRecording(false)
    setInterim('')
  }, [])

  const clearError = useCallback(() => setError(''), [])

  return { recording, interim, error, supported, start, stop, clearError }
}
