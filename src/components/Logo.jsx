export default function Logo({ showWordmark = false, size = 36, variant = 'default' }) {
  const light = variant === 'light'

  return (
    <div className="flex items-center gap-2.5">
      {/* Sobre fondo azul el logo va en un círculo blanco: sus figuras azules
          no se distinguían del fondo. */}
      {light ? (
        <span style={{
          width: Math.round(size * 1.3), height: Math.round(size * 1.3), borderRadius: '50%',
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', flexShrink: 0,
        }}>
          <img src="/logo.png" alt="FamiliaCerca" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
        </span>
      ) : (
        <img
          src="/logo.png"
          alt="FamiliaCerca"
          width={size}
          height={size}
          style={{ objectFit: 'contain', display: 'block' }}
        />
      )}

      {showWordmark && (
        <div>
          <p
            className="text-[17px] font-bold leading-tight"
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              color: light ? 'white' : '#0C6C9C',
            }}
          >
            FamiliaCerca
          </p>
          <p
            className="text-[11px] leading-none tracking-widest uppercase mt-1"
            style={{ color: light ? 'rgba(255,255,255,0.8)' : '#5E7480' }}
          >
            Cuidado con amor
          </p>
        </div>
      )}
    </div>
  )
}
