import { useEffect, useState } from 'react'

export default function SuccessAnimation({ visible, size = 48 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!visible) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 1500)
    return () => clearTimeout(t)
  }, [visible])

  if (!show) return null

  return (
    <>
      <style>{`
        @keyframes successPop {
          0%   { transform: scale(0);   opacity: 0; }
          40%  { transform: scale(1.25); opacity: 1; }
          65%  { transform: scale(0.95); opacity: 1; }
          80%  { transform: scale(1);   opacity: 1; }
          100% { transform: scale(0);   opacity: 0; }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: size + 32, height: size + 32,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.15)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'successPop 1.5s cubic-bezier(0.4,0,0.2,1) forwards',
        }}>
          <span style={{ fontSize: size, lineHeight: 1 }}>✅</span>
        </div>
      </div>
    </>
  )
}

export function useSuccessAnimation() {
  const [trigger, setTrigger] = useState(0)
  function fire() { setTrigger(t => t + 1) }
  return { trigger, fire }
}
