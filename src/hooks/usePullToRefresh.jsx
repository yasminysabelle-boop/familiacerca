import { useCallback, useRef, useState } from 'react'

const THRESHOLD = 60

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(null)
  const containerRef = useRef(null)

  const onTouchStart = useCallback((e) => {
    const el = containerRef.current
    if (el && el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e) => {
    if (startY.current === null) return
    const el = containerRef.current
    if (el && el.scrollTop > 0) { startY.current = null; return }
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) return
    setPulling(true)
    setPullDistance(Math.min(dy * 0.5, THRESHOLD + 20))
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return
    setPulling(false)
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(0)
      try { await onRefresh() } finally { setRefreshing(false) }
    } else {
      setPullDistance(0)
    }
    startY.current = null
  }, [pulling, pullDistance, onRefresh])

  function PullIndicator() {
    if (!pulling && !refreshing) return null
    return (
      <>
        <style>{`@keyframes pullSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: refreshing ? 44 : Math.max(pullDistance, 0),
          overflow: 'hidden',
          transition: refreshing ? 'none' : 'height 0.1s',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2.5px solid #EDE5D8',
            borderTopColor: '#4A7C59',
            animation: refreshing ? 'pullSpin 0.7s linear infinite' : 'none',
            opacity: Math.min(pullDistance / THRESHOLD, 1),
            transform: refreshing ? 'none' : `rotate(${(pullDistance / THRESHOLD) * 180}deg)`,
            transition: refreshing ? 'none' : 'transform 0.05s linear',
          }} />
        </div>
      </>
    )
  }

  return { containerRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, PullIndicator }
}
