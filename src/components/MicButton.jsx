import { Mic } from './Icons'

export default function MicButton({ onStart, onStop, recording, size = 'md' }) {
  const dim    = size === 'sm' ? 34 : 40
  const iconSz = size === 'sm' ? 14 : 17

  function handleClick(e) {
    e.preventDefault()
    recording ? onStop() : onStart()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={recording ? 'animate-mic-pulse' : ''}
      style={{
        height: dim,
        minWidth: dim,
        width: recording ? 'auto' : dim,
        borderRadius: recording ? 20 : '50%',
        flexShrink: 0,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingInline: recording ? 12 : 0,
        background: recording ? '#D63031' : '#F3F4F6',
        transition: 'background 0.15s, border-radius 0.2s, width 0.2s',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <Mic size={iconSz} color={recording ? 'white' : '#6B7280'} strokeWidth={1.75} />
      {recording && (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
          Grabando...
        </span>
      )}
    </button>
  )
}
