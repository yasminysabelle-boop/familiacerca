export default function Logo({ showWordmark = false, size = 36, variant = 'default' }) {
  const light = variant === 'light'

  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* Outer ring */}
        <circle cx="20" cy="20" r="20" fill={light ? 'white' : '#4A7C59'} />
        {/* Soft inner highlight */}
        <circle cx="14" cy="13" r="8"
          fill={light ? '#4A7C59' : 'white'}
          fillOpacity="0.07"
        />
        {/* FC monogram */}
        <text
          x="20" y="19"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={light ? '#4A7C59' : 'white'}
          fontSize="14"
          fontWeight="800"
          fontFamily="Georgia, serif"
          letterSpacing="-0.5"
        >
          FC
        </text>
        {/* Heart accent */}
        <text
          x="20" y="31"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={light ? '#4A7C59' : 'white'}
          fillOpacity={light ? '0.7' : '0.82'}
          fontSize="10"
        >
          ♥
        </text>
      </svg>

      {showWordmark && (
        <div>
          <p
            className="text-[15px] font-bold leading-tight"
            style={{
              fontFamily: 'Georgia, serif',
              color: light ? 'white' : '#4A7C59',
            }}
          >
            FamiliaCerca
          </p>
          <p
            className="text-[9px] leading-none tracking-widest uppercase mt-0.5"
            style={{ color: light ? 'rgba(255,255,255,0.55)' : '#9CA3AF' }}
          >
            Cuidado con amor
          </p>
        </div>
      )}
    </div>
  )
}
