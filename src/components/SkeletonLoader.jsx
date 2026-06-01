const BASE = {
  background: 'linear-gradient(90deg, #E5E0D8 25%, #EDE9E3 50%, #E5E0D8 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonShimmer 1.4s ease-in-out infinite',
  borderRadius: 8,
}

export function SkeletonCard({ height = 100, borderRadius = 16, style = {} }) {
  return (
    <>
      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0; opacity: 0.7; }
          50%  { background-position: -200% 0; opacity: 1; }
          100% { background-position: 200% 0; opacity: 0.7; }
        }
      `}</style>
      <div style={{ ...BASE, height, borderRadius, ...style }} />
    </>
  )
}

export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return (
    <div style={{ ...BASE, width, height, borderRadius: 6, ...style }} />
  )
}

export function SkeletonAvatar({ size = 44, style = {} }) {
  return (
    <div style={{ ...BASE, width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }} />
  )
}

export function SkeletonMedCard() {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <SkeletonAvatar size={12} />
        <SkeletonLine width={140} height={15} />
      </div>
      <SkeletonLine width={90} height={11} style={{ marginBottom: 8 }} />
      <SkeletonLine width={60} height={11} />
    </div>
  )
}

export function SkeletonEventCard() {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '13px 15px', display: 'flex', gap: 12 }}>
      <SkeletonAvatar size={38} style={{ borderRadius: 10 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonLine width={80} height={11} />
        <SkeletonLine width="85%" height={14} />
        <SkeletonLine width={60} height={11} />
      </div>
    </div>
  )
}

export function SkeletonExpenseCard() {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <SkeletonAvatar size={40} style={{ borderRadius: 10 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonLine width={120} height={14} />
        <SkeletonLine width={80} height={11} />
      </div>
      <SkeletonLine width={50} height={18} style={{ borderRadius: 8 }} />
    </div>
  )
}

export function SkeletonDashSummary() {
  return (
    <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '16px 18px', marginBottom: 12 }}>
      <SkeletonLine width={120} height={14} style={{ marginBottom: 14 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SkeletonAvatar size={18} />
            <SkeletonLine width={`${60 + i * 10}%`} height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}
