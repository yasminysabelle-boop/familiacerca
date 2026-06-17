import { useEffect, useRef } from 'react'
import { useSpeechToText } from '../hooks/useSpeechToText'

/**
 * VoiceInput — campo de texto con botón de micrófono integrado.
 * Props:
 *   value        string    — valor controlado
 *   onChange     fn(str)   — callback cuando cambia el texto
 *   placeholder  string
 *   rows         number    — si >1, usa <textarea>; si 1, usa <input>
 *   label        string    — etiqueta visible
 *   disabled     boolean
 *   onSave       fn()      — opcional, muestra botón "Guardar"
 *   saving       boolean   — estado de guardado
 */
export default function VoiceInput({
  value = '',
  onChange,
  placeholder = 'Escribe o usa el micrófono...',
  rows = 3,
  label,
  disabled = false,
  onSave,
  saving = false,
}) {
  const interimRef = useRef('')

  function handleFinalResult(text) {
    interimRef.current = ''
    onChange((value + ' ' + text).trimStart())
  }

  const { recording, interim, error, supported, start, stop, clearError } =
    useSpeechToText(handleFinalResult)

  useEffect(() => {
    interimRef.current = interim
  }, [interim])

  const displayValue = recording && interim
    ? value + (value ? ' ' : '') + interim
    : value

  const micColor   = recording ? '#EF4444' : '#0d6b63'
  const micBg      = recording ? 'rgba(239,68,68,0.08)' : 'rgba(13,107,99,0.08)'
  const inputStyle = {
    width: '100%',
    padding: '10px 44px 10px 12px',
    borderRadius: 10,
    border: `1.5px solid ${recording ? '#FCA5A5' : '#D1C9BF'}`,
    fontSize: 14,
    lineHeight: 1.5,
    color: recording ? '#6B7280' : '#1A1A1A',
    background: disabled ? '#F9F5F0' : 'white',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        {rows > 1 ? (
          <textarea
            rows={rows}
            value={displayValue}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || recording}
            style={inputStyle}
          />
        ) : (
          <input
            type="text"
            value={displayValue}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || recording}
            style={{ ...inputStyle, padding: '10px 44px 10px 12px' }}
          />
        )}

        {/* Mic button */}
        {supported && !disabled && (
          <button
            type="button"
            onClick={() => recording ? stop() : start()}
            aria-label={recording ? 'Detener grabación' : 'Grabar voz'}
            style={{
              position: 'absolute',
              right: 8,
              top: rows > 1 ? 8 : '50%',
              transform: rows > 1 ? 'none' : 'translateY(-50%)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: micBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            {recording ? (
              <span style={{ fontSize: 14 }}>⏹</span>
            ) : (
              <MicIcon color={micColor} />
            )}
            {recording && (
              <span style={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                border: '2px solid #EF4444',
                animation: 'pulse 1.2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}
          </button>
        )}
      </div>

      {/* Interim transcript hint */}
      {recording && interim && (
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>
          {interim}...
        </p>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <span style={{ fontSize: 12, color: '#DC2626', flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={clearError}
            style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Save button */}
      {onSave && value.trim() && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving || recording}
          style={{
            alignSelf: 'flex-end',
            padding: '8px 20px',
            borderRadius: 10,
            border: 'none',
            background: saving ? '#9CA3AF' : '#0d6b63',
            color: 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}

function MicIcon({ color = '#0d6b63', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  )
}
