import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Si la familia está conectada a una agencia de cuidado, la app muestra su
// marca. La dueña de la familia puede quitar el acceso (nov 2026).

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const onColor = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#14303D' : 'white' }

export default function AgencyBadge({ ownerId, isOwner }) {
  const navigate = useNavigate()
  const [ag, setAg] = useState(null)
  const [open, setOpen] = useState(false)

  // Llegó por el enlace de la agencia antes de tener cuenta: retomarlo
  useEffect(() => {
    try { const c = localStorage.getItem('fc_agency_code'); if (c) navigate(`/unirme-agencia?codigo=${c}`) } catch { /* */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ownerId) return
    setAg(null)
    supabase.rpc('family_agency', { p_owner: ownerId }).then(({ data, error }) => { if (!error && data) setAg(data) })
  }, [ownerId])

  if (!ag) return null
  const color = ag.color || '#0C6C9C', fg = onColor(color)
  async function unlink() {
    if (!window.confirm(`¿Quitar el acceso de ${ag.nombre}? La agencia dejará de ver el cuidado y sus cuidadoras saldrán de tu familia.`)) return
    const { data } = await supabase.rpc('agency_unlink_family')
    if (data?.ok) setAg(null)
  }
  return (
    <div style={{ marginTop: 14, borderRadius: 18, background: color, color: fg, padding: '12px 14px', fontFamily: SANS }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', padding: 0, color: fg, textAlign: 'left', cursor: 'pointer', fontFamily: SANS }}>
        {ag.logo ? <img src={ag.logo} alt="" style={{ height: 36, background: 'white', borderRadius: 10, padding: 3 }} /> : <span style={{ width: 36, height: 36, borderRadius: 10, background: 'white', color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ag.nombre[0]}</span>}
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, opacity: 0.85 }}>Cuidado por</span>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{ag.nombre}</span>
        </span>
        <span style={{ fontSize: 20 }}>{open ? '˄' : '˅'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 8px' }}>{ag.nombre} ve el cuidado de su paciente (visitas, medicinas, rutina y notas) con el permiso de la familia{ag.desde ? `, desde el ${new Date(ag.desde).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>
          {isOwner && <button onClick={unlink} style={{ background: 'white', color: '#A3452F', border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Quitar el acceso de la agencia</button>}
        </div>
      )}
    </div>
  )
}
