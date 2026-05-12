import { Mic } from './Icons'

export default function MicButton({ onStart, onStop, recording, size = 'md' }) {
  const dim     = size === 'sm' ? 34 : 40
  const iconSz  = size === 'sm' ? 14 : 17

  function down(e) {
    e.preventDefault()
    onStart()
  }

  function up(e) {
    e.preventDefault()
    onStop()
  }

  return (
    <button
      type="button"
      onMouseDown={down}
      onMouseUp={up}
      onMouseLeave={recording ? up : undefined}
      onTouchStart={down}
      onTouchEnd={up}
      onTouchCancel={up}
      className={recording ? 'animate-mic-pulse' : ''}
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        flexShrink: 0,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: recording ? '#D63031' : '#F3F4F6',
        transition: 'background 0.15s',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <Mic size={iconSz} color={recording ? 'white' : '#6B7280'} strokeWidth={1.75} />
    </button>
  )
}
