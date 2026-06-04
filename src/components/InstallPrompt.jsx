import { useInstallPrompt } from '../hooks/useInstallPrompt'

export default function InstallPrompt() {
  const { canInstall, showIOSBanner, install, dismiss } = useInstallPrompt()

  if (!canInstall && !showIOSBanner) return null

  if (showIOSBanner) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 1000,
        background: 'white', borderRadius: 20,
        border: '1px solid #EDE5D8',
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icon-72.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Instalar FamiliaCerca</p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>Accede sin internet · Notificaciones</p>
            </div>
          </div>
          <button
            onClick={() => dismiss()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18, padding: 2, flexShrink: 0 }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div style={{
          background: '#F7F3ED', borderRadius: 12, padding: '10px 14px',
          fontSize: 13, color: '#374151', lineHeight: 1.6,
        }}>
          <p style={{ margin: 0 }}>
            Toca <strong>Compartir</strong> <span style={{ fontSize: 15 }}>⬆</span> en Safari,
            luego <strong>"Agregar a pantalla de inicio"</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 1000,
      background: 'white', borderRadius: 20,
      border: '1px solid #EDE5D8',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <img src="/icon-72.png" alt="" width={44} height={44} style={{ borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Instalar FamiliaCerca</p>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>Acceso rápido · Funciona sin internet</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => dismiss()}
          style={{
            padding: '8px 12px', borderRadius: 10,
            border: '1px solid #EDE5D8', background: 'white',
            fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
        <button
          onClick={install}
          style={{
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #2D4A1E, #4A7C59)',
            fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
          }}
        >
          Instalar
        </button>
      </div>
    </div>
  )
}
