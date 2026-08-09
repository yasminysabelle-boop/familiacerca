export default function Logo({ showWordmark = false, size = 36, variant = 'default' }) {
  const light = variant === 'light'

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.png"
        alt="FamiliaCerca"
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
      />

      {showWordmark && (
        <div>
          <p
            className="text-[15px] font-bold leading-tight"
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              color: light ? 'white' : '#087F70',
            }}
          >
            FamiliaCerca
          </p>
          <p
            className="text-[9px] leading-none tracking-widest uppercase mt-0.5"
            style={{ color: light ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}
          >
            Cuidado con amor
          </p>
        </div>
      )}
    </div>
  )
}
