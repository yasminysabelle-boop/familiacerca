import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechToText(onResult) {
  const [recording, setRecording] = useState(false)
  const [interim,   setInterim]   = useState('')
  const [error,     setError]     = useState('')

  const recRef      = useRef(null)
  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    if (!supported) {
      setError('Tu navegador no soporta esta función. Usa Chrome para esta función.')
      return
    }
    setError('')
    setInterim('')

    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang            = 'es-MX'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onresult = e => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          onResultRef.current(t.trim())
          setInterim('')
        } else {
          live += t
        }
      }
      if (live) setInterim(live)
    }

    rec.onerror = e => {
      if (e.error === 'not-allowed') {
        setError('Micrófono bloqueado. Actívalo en la configuración del navegador.')
      } else if (e.error === 'no-speech') {
        // silence — not a real error
      } else if (e.error !== 'aborted') {
        setError('No se pudo transcribir. Inténtalo de nuevo.')
      }
      setRecording(false)
      setInterim('')
    }

    rec.onend = () => {
      setRecording(false)
      setInterim('')
    }

    recRef.current = rec
    rec.start()
    setRecording(true)
  }, [supported])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
  }, [])

  const clearError = useCallback(() => setError(''), [])

  return { recording, interim, error, supported, start, stop, clearError }
}
