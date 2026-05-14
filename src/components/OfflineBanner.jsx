import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      background: '#1F2937', padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>📵</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
        Sin conexión — tus datos están seguros y se sincronizarán cuando vuelva la conexión 💙
      </span>
    </div>
  )
}
