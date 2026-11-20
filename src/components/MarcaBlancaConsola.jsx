import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Consola → Demos de marca blanca (nov 2026). Crea una demo con el nombre,
// logo, color y precio de una agencia y te da el enlace /demo/<código>.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const C = { blue: '#0C6C9C', ink: '#14303D', sub: '#4E6470', line: '#E6E3DB', coral: '#BF513C', soft: '#EEF6FA' }
const field = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: SANS, color: C.ink, background: 'white' }
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: C.sub, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const btn = bg => ({ padding: '10px 16px', borderRadius: 12, border: 'none', background: bg, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS })
const empty = { codigo: null, nombre: '', color: '#2E7D6B', logo: null, precio: 19.99 }

// Achica el logo a 256 px para guardarlo liviano
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, 256 / Math.max(img.width, img.height))
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
      URL.revokeObjectURL(img.src); resolve(cv.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function MarcaBlancaConsola({ demo }) {
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState(null)
  const link = c => `${window.location.origin}/demo/${c}`

  async function load() {
    if (demo) { setList([]); return }
    const { data, error } = await supabase.rpc('admin_wl_demos')
    setList(error ? [] : data)
  }
  useEffect(() => { load() }, [demo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form.nombre.trim()) return
    if (demo) { setMsg({ ok: true, text: 'En la consola real esto crea el enlace de demo para ese cliente.' }); setForm(null); return }
    const { data, error } = await supabase.rpc('admin_wl_demo_save', { p_code: form.codigo, p_name: form.nombre.trim(), p_color: form.color, p_logo: form.logo, p_price: Number(form.precio) || 0 })
    if (error || !data?.ok) { setMsg({ ok: false, text: 'No se pudo guardar. ¿Ya corriste el SQL de marca blanca?' }); return }
    setMsg({ ok: true, text: `Demo lista: ${link(data.codigo)}` }); setForm(null); load()
  }
  async function remove(d) {
    if (!window.confirm(`¿Borrar la demo de ${d.nombre}? El enlace dejará de funcionar.`)) return
    await supabase.rpc('admin_wl_demo_delete', { p_code: d.codigo }); load()
  }

  return (
    <section style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Demos de marca blanca</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: C.sub }}>Para agencias: la app con su logo, su nombre, su color y su precio. Les mandas el enlace.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/demo/ejemplo" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontWeight: 700, fontSize: 15 }}>Ver ejemplo ›</a>
          {!form && <button onClick={() => setForm({ ...empty })} style={btn(C.coral)}>+ Nueva demo</button>}
        </div>
      </div>
      {msg && <p style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 12, background: msg.ok ? C.soft : '#FBEAE4', fontSize: 15, wordBreak: 'break-all' }}>{msg.text}</p>}

      {form && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={label}>Nombre de la agencia</label><input style={field} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cuidado en Casa Luz" /></div>
            <div>
              <label style={label}>Logo</label>
              <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { setForm({ ...form, logo: await readLogo(f) }) } catch { setMsg({ ok: false, text: 'No se pudo leer esa imagen.' }) } } }} style={{ fontSize: 14, fontFamily: SANS }} />
              {form.logo && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}><img src={form.logo} alt="" style={{ height: 48, background: form.color, padding: 6, borderRadius: 10 }} /><button onClick={() => setForm({ ...form, logo: null })} style={{ background: 'none', border: 'none', color: C.sub, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Quitar</button></div>}
            </div>
            <div><label style={label}>Color de su marca</label><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 64, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} /></div>
            <div><label style={label}>Precio sugerido por familia al mes (USD)</label><input style={field} type="number" min="0" step="0.5" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setForm(null)} style={{ ...btn('white'), color: C.ink, border: `1.5px solid ${C.line}` }}>Cancelar</button>
            <button onClick={save} style={btn(C.blue)}>Crear enlace de demo</button>
          </div>
        </div>
      )}

      {list?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {list.map(d => (
            <div key={d.codigo} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {d.logo ? <img src={d.logo} alt="" style={{ maxWidth: 32, maxHeight: 32 }} /> : <span style={{ color: 'white', fontWeight: 800 }}>{d.nombre[0]}</span>}
              </span>
              <span style={{ flex: 1, minWidth: 160 }}>
                <strong style={{ display: 'block', fontSize: 15 }}>{d.nombre}</strong>
                <span style={{ fontSize: 13, color: C.sub }}>{link(d.codigo).replace(/^https?:\/\//, '')}</span>
              </span>
              <button onClick={async () => { try { await navigator.clipboard.writeText(link(d.codigo)); setCopied(d.codigo); setTimeout(() => setCopied(null), 2000) } catch { /* */ } }} style={{ ...btn(C.blue), padding: '7px 12px', fontSize: 14 }}>{copied === d.codigo ? '✓ Copiado' : 'Copiar enlace'}</button>
              <a href={`/demo/${d.codigo}`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontWeight: 700, fontSize: 14 }}>Abrir</a>
              <button onClick={() => setForm({ ...d })} style={{ background: 'none', border: 'none', color: C.blue, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Editar</button>
              <button onClick={() => remove(d)} style={{ background: 'none', border: 'none', color: C.sub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Borrar</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
