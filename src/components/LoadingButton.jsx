export default function LoadingButton({
  onClick,
  loading = false,
  children,
  loadingText = 'Guardando...',
  variant = 'primary',
  disabled = false,
  style = {},
  type = 'button',
  ...props
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, fontWeight: 700, fontSize: 14,
    cursor: loading || disabled ? 'not-allowed' : 'pointer',
    opacity: loading || disabled ? 0.7 : 1,
    border: 'none', transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
  }

  const variants = {
    primary: {
      background: '#0C6C9C',
      color: 'white',
      boxShadow: loading || disabled ? 'none' : '0 4px 14px rgba(12,108,156,0.3)',
    },
    danger: {
      background: 'linear-gradient(135deg, #D63031, #B82020)',
      color: 'white',
      boxShadow: loading || disabled ? 'none' : '0 4px 14px rgba(214,48,49,0.3)',
    },
    secondary: {
      background: 'white',
      color: '#30454F',
      border: '1.5px solid #E6E3DB',
      boxShadow: 'none',
    },
  }

  return (
    <>
      <style>{`
        @keyframes btnSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <button
        type={type}
        onClick={loading || disabled ? undefined : onClick}
        disabled={loading || disabled}
        style={{ ...base, ...variants[variant] ?? variants.primary, ...style }}
        {...props}
      >
        {loading && (
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: variant === 'secondary' ? '#0C6C9C' : 'white',
            flexShrink: 0,
            animation: 'btnSpin 0.65s linear infinite',
            display: 'inline-block',
          }} />
        )}
        {loading ? loadingText : children}
      </button>
    </>
  )
}
