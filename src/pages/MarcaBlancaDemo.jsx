import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StaffPanel, BillingPanel, BrandPanel } from '../components/MarcaBlancaGestion'

// Demo de marca blanca para agencias de cuidado en casa (nov 2026).
// /demo/<código> muestra la app con el nombre, logo y color de la agencia,
// con datos de ejemplo. /demo/ejemplo funciona sin base de datos.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const INK = '#14303D', SUB = '#5E7480', LINE = '#E6E3DB'
const EJEMPLO = { nombre: 'Cuidado en Casa Ejemplo', color: '#2E7D6B', logo: null, precio: 19.99 }

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (c, w) => { const [r, g, b] = hex(c); const m = v => Math.round(v + (255 - v) * w).toString(16).padStart(2, '0'); return `#${m(r)}${m(g)}${m(b)}` }
const onColor = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? INK : 'white' }
const money = n => (Number(n) || 0).toLocaleString('es', { style: 'currency', currency: 'USD' })

function Logo({ brand, size = 40 }) {
  if (brand.logo) return <img src={brand.logo} alt="" width={size} height={size} style={{ objectFit: 'contain', background: 'white', borderRadius: size / 4, padding: size / 10 }} />
  const ini = brand.nombre.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return <span style={{ width: size, height: size, borderRadius: size / 4, background: 'white', color: brand.color, fontWeight: 800, fontSize: size * 0.38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ini}</span>
}

// ── La app como la ven las familias ─────────────────────────────────────────
export function Phone({ brand, start = 'inicio' }) {
  const [tab, setTab] = useState(start)
  const [meds, setMeds] = useState([true, false, false])
  const [rutina, setRutina] = useState([true, true, true, false, false, false])
  const [sos, setSos] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const fg = onColor(brand.color), soft = mix(brand.color, 0.88)
  const card = { background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, border: `1px solid ${LINE}` }
  const h = { margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: INK }
  const MEDS = [['8:00 am', 'Losartán 50 mg', '1 pastilla con desayuno'], ['2:00 pm', 'Metformina 500 mg', 'Después del almuerzo'], ['9:00 pm', 'Atorvastatina 20 mg', 'Antes de dormir']]
  const RUT = ['Desayuno', 'Baño', 'Caminata 15 min', 'Almuerzo', 'Ejercicios de manos', 'Cena']
  const check = (on, onClick, text, sub) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 0', borderTop: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: SANS }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${on ? brand.color : '#C9D3D8'}`, background: on ? brand.color : 'white', color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{on ? '✓' : ''}</span>
      <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK, textDecoration: on ? 'line-through' : 'none' }}>{text}</span>{sub && <span style={{ display: 'block', fontSize: 12, color: SUB }}>{sub}</span>}</span>
    </button>
  )
  const screens = {
    inicio: (
      <>
        <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: INK }}>Hola, Carmen 👋</p>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: SUB }}>Cuidando a <strong>Doña Rosa</strong></p>
        <div style={{ ...card, background: soft, border: 'none' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: brand.color, textTransform: 'uppercase' }}>Cuidadora de {brand.nombre}</p>
          <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: INK }}>🟢 Marisol llegó a las 8:02 am</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: SUB }}>“Desayunó bien y salimos a caminar.”</p>
        </div>
        <div style={card}>
          <p style={h}>💊 Próxima medicina</p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>2:00 pm · Metformina 500 mg</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: SUB }}>{meds.filter(Boolean).length} de 3 tomadas hoy</p>
        </div>
        <div style={card}>
          <p style={h}>☀️ Rutina de hoy · {rutina.filter(Boolean).length} de {RUT.length}</p>
          {RUT.slice(0, 4).map((r, i) => <div key={r}>{check(rutina[i], () => setRutina(x => x.map((v, j) => j === i ? !v : v)), r)}</div>)}
        </div>
        <button onClick={() => setSos(true)} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: '#C0392B', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>🚨 Emergencia</button>
        {sos && <p style={{ margin: '8px 0 0', padding: 10, borderRadius: 12, background: '#FBEAE4', fontSize: 13, color: '#A3452F' }}>En la app real se avisa al instante a toda la familia y a {brand.nombre}. (Demo: no se envió nada.)</p>}
      </>
    ),
    medicinas: (
      <>
        <p style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: INK }}>Medicinas de hoy</p>
        <div style={card}>{MEDS.map((m, i) => <div key={m[1]}>{check(meds[i], () => setMeds(x => x.map((v, j) => j === i ? !v : v)), `${m[0]} · ${m[1]}`, m[2])}</div>)}</div>
        <p style={{ fontSize: 13, color: SUB, margin: 0 }}>Cuando alguien marca una medicina, toda la familia lo ve. Si se olvida, la app avisa.</p>
      </>
    ),
    visitas: (
      <>
        <p style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: INK }}>Visitas de la cuidadora</p>
        {[['Hoy', '8:02 am – en casa', 'Desayunó bien y salimos a caminar.'], ['Ayer', '8:05 am – 4:10 pm', 'Durmió siesta. Tomó todas sus medicinas.'], ['Lunes', '7:58 am – 4:00 pm', 'Le hice ejercicios de manos. Buen ánimo.']].map(([d, t, n]) => (
          <div key={d} style={card}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: brand.color, textTransform: 'uppercase' }}>{d} · Marisol</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: INK }}>{t}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: SUB }}>📝 {n}</p>
          </div>
        ))}
        <div style={{ ...card, background: soft, border: 'none' }}><p style={{ margin: 0, fontSize: 14, color: INK }}><strong>24 h 15 min</strong> de cuidado esta semana</p></div>
      </>
    ),
    familia: (
      <>
        <p style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: INK }}>La familia</p>
        <div style={card}>
          {[['Carmen', 'Hija · organiza'], ['José', 'Hijo · vive en otro estado'], ['Ana', 'Nieta'], ['Marisol', `Cuidadora · ${brand.nombre}`]].map(([n, r]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${LINE}` }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: soft, color: brand.color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</span>
              <span><span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>{n}</span><span style={{ fontSize: 12, color: SUB }}>{r}</span></span>
            </div>
          ))}
        </div>
        <div style={card}>
          <p style={h}>Tareas de la semana</p>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: INK }}>✅ José · pagar la farmacia</p>
          <p style={{ margin: 0, fontSize: 14, color: INK }}>⬜ Ana · llevarla a la cita del jueves</p>
        </div>
      </>
    ),
    plan: (
      <>
        <p style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: INK }}>Tu plan</p>
        <div style={{ ...card, border: `2px solid ${brand.color}`, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><span style={{ background: brand.color, borderRadius: 14, padding: 6 }}><Logo brand={brand} size={40} /></span></div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK }}>Plan Familia de {brand.nombre}</p>
          <p style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, color: brand.color }}>{money(brand.precio)}<span style={{ fontSize: 14, color: SUB, fontWeight: 600 }}> /mes</span></p>
          <p style={{ margin: '8px 0 12px', fontSize: 13, color: SUB, lineHeight: 1.5 }}>Toda la familia conectada · visitas de la cuidadora en vivo · medicinas y rutina · alertas de emergencia</p>
          <button onClick={() => setSubscribed(true)} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: brand.color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>{subscribed ? '✓ Suscrita (demo)' : 'Suscribirme'}</button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: SUB }}>🔒 Pago seguro · Cancela cuando quieras</p>
        </div>
      </>
    ),
  }
  const NAV = [['inicio', '🏠', 'Inicio'], ['medicinas', '💊', 'Medicinas'], ['visitas', '🕒', 'Visitas'], ['familia', '👨‍👩‍👧', 'Familia'], ['plan', '⭐', 'Plan']]
  return (
    <div style={{ width: 320, maxWidth: '100%', margin: '0 auto', borderRadius: 40, border: '10px solid #1B262C', background: '#F7F6F2', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', height: 640, fontFamily: SANS }}>
      <div style={{ background: brand.color, color: fg, padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo brand={brand} size={30} />
        <span style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand.nombre}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{screens[tab]}</div>
      <nav style={{ display: 'flex', borderTop: `1px solid ${LINE}`, background: 'white' }}>
        {NAV.map(([k, ic, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '8px 0 10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, color: tab === k ? brand.color : SUB, fontWeight: tab === k ? 800 : 600, fontSize: 11 }}>
            <span style={{ display: 'block', fontSize: 18 }}>{ic}</span>{l}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ── El panel de la agencia (lo que ve la dueña o la coordinadora) ───────────
export function AgencyPanel({ b, families, price }) {
  const soft = mix(b.color, 0.88)
  const box = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: 20 }
  const tile = (l, v, sub, accent) => (
    <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '16px 18px' }}>
      <p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p>
      <p style={{ margin: '6px 0 2px', fontSize: 28, fontWeight: 800, color: accent || INK }}>{v}</p>
      {sub && <p style={{ margin: 0, fontSize: 13, color: SUB }}>{sub}</p>}
    </div>
  )
  const growth = [0.42, 0.53, 0.64, 0.74, 0.86, 1].map(f => Math.round(families * f))
  const months = growth.map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toLocaleDateString('es', { month: 'short' }) })
  const max = Math.max(1, ...growth)
  const atrasadas = Math.max(1, Math.round(families * 0.04))
  const SUBS = [['Familia Rivera', 'hace 2 días', 'al día'], ['Familia Gómez', 'hace 4 días', 'al día'], ['Familia Torres', 'hace 1 semana', 'atrasado'], ['Familia Méndez', 'hace 1 semana', 'al día'], ['Familia Castillo', 'hace 2 semanas', 'al día']]
  const VIS = [['Marisol', 'Doña Rosa · Familia Rivera', 'En casa desde 8:02 am', '#1E6B3E'], ['Yolanda', 'Don Pedro · Familia Gómez', 'En casa desde 7:55 am', '#1E6B3E'], ['Carmen L.', 'Doña Luz · Familia Torres', 'Terminó 12:30 pm', SUB], ['Rafael', 'Don Julio · Familia Méndez', 'Llega a las 2:00 pm', '#7A5410']]
  const USO = [['Cuidados de la rutina marcados', 4120], ['Medicinas marcadas', 2890], ['Notas de las cuidadoras', 1340], ['Mensajes entre familias', 860], ['Alertas de emergencia', 4]]
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {tile('Familias suscritas', families.toLocaleString('es'), `+${growth[5] - growth[4]} este mes`, b.color)}
        {tile('Ingreso este mes', money(families * (price || 0)), `${money(price)} por familia`)}
        {tile('Pagos atrasados', atrasadas, `${money(atrasadas * (price || 0))} por cobrar`, '#A3452F')}
        {tile('Horas de cuidado este mes', Math.round(families * 26).toLocaleString('es'), 'Registradas por sus cuidadoras')}
        {tile('Visitas a tiempo', '96%', 'Llegada dentro de 10 min')}
      </div>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: 14 }}>
        <div style={box}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Familias suscritas por mes</p>
          <svg viewBox="0 0 360 190" style={{ width: '100%', height: 'auto', marginTop: 10 }} role="img" aria-label="Familias suscritas por mes">
            {growth.map((v, i) => { const h = (v / max) * 140; const x = 12 + i * 58; return (
              <g key={i}>
                <rect x={x} y={160 - h} width={40} height={h} rx="6" fill={i === 5 ? b.color : mix(b.color, 0.6)} />
                <text x={x + 20} y={154 - h} fontSize="12" fontWeight="700" textAnchor="middle" fill={INK}>{v}</text>
                <text x={x + 20} y={178} fontSize="11" textAnchor="middle" fill={SUB}>{months[i]}</text>
              </g>) })}
          </svg>
        </div>
        <div style={box}>
          <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Visitas de hoy</p>
          {VIS.map(([c, f, st, col]) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${LINE}` }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: soft, color: b.color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c[0]}</span>
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15 }}>{c}</strong><span style={{ fontSize: 13, color: SUB }}>{f}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: col, textAlign: 'right' }}>{st}</span>
            </div>
          ))}
        </div>
        <div style={box}>
          <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Suscriptores recientes</p>
          {SUBS.map(([n, d, st]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${LINE}` }}>
              <span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 15 }}>{n}</strong><span style={{ fontSize: 13, color: SUB }}>Plan Familia · se unió {d}</span></span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: st === 'al día' ? '#E3F4EA' : '#FBEAE4', color: st === 'al día' ? '#1E6B3E' : '#A3452F' }}>{st === 'al día' ? 'Al día' : 'Atrasado'}</span>
            </div>
          ))}
        </div>
        <div style={box}>
          <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>Lo que más usan las familias</p>
          {USO.map(([l, n]) => (
            <div key={l} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{l}</span><strong>{n.toLocaleString('es')}</strong></div>
              <div style={{ height: 10, borderRadius: 6, background: soft }}><div style={{ width: `${Math.max(2, (n / USO[0][1]) * 100)}%`, height: '100%', borderRadius: 6, background: b.color }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MarcaBlancaDemo() {
  const { code } = useParams()
  const [brand, setBrand] = useState(code === 'ejemplo' ? EJEMPLO : null)
  const [missing, setMissing] = useState(false)
  const [view, setView] = useState('app')
  const [price, setPrice] = useState(null)
  const [families, setFamilies] = useState(120)

  useEffect(() => {
    if (code === 'ejemplo') return
    supabase.rpc('wl_demo_get', { p_code: code }).then(({ data }) => { if (data) setBrand(data); else setMissing(true) })
  }, [code])
  useEffect(() => { if (brand) { document.title = `${brand.nombre} · Demo`; setPrice(p => p ?? brand.precio) } }, [brand])

  if (missing) return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: SUB }}>Esta demo no existe o ya no está disponible.</div>
  if (!brand) return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: SUB }}>Cargando…</div>
  const b = { ...brand, precio: price ?? brand.precio }
  const fg = onColor(b.color)
  const tabBtn = k => ({ padding: '10px 18px', borderRadius: 999, border: 'none', background: view === k ? b.color : 'white', color: view === k ? fg : INK, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS })
  const box = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: 22 }
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: SANS, color: INK }}>
      <header style={{ background: b.color, color: fg, padding: '16px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo brand={b} size={44} />
          <div>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{b.nombre}</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>Su app de cuidado familiar · con la tecnología de FamiliaCerca</p>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 16px 48px' }}>
        <p style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 14, background: '#FDF3DF', color: '#7A5410', fontSize: 15, fontWeight: 600 }}>
          Demo con datos de ejemplo: así se vería la app con la marca de {b.nombre}. Toque las pantallas y pruebe cada pestaña; nada se guarda.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={() => setView('app')} style={tabBtn('app')}>La app para sus familias</button>
          <button onClick={() => setView('panel')} style={tabBtn('panel')}>Su panel</button>
          <button onClick={() => setView('personal')} style={tabBtn('personal')}>Su personal</button>
          <button onClick={() => setView('facturacion')} style={tabBtn('facturacion')}>Facturación</button>
          <button onClick={() => setView('precio')} style={tabBtn('precio')}>Su precio</button>
          <button onClick={() => setView('marca')} style={tabBtn('marca')}>Su marca</button>
        </div>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          {view === 'panel' ? <AgencyPanel b={b} families={families} price={price} /> : view === 'personal' ? <StaffPanel b={b} /> : view === 'facturacion' ? <BillingPanel b={b} families={families} price={price || 0} /> : view === 'marca' ? <BrandPanel b={b} onChange={ch => setBrand(x => ({ ...x, ...ch }))} /> : view === 'app' ? (
            <div style={box}>
              <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800 }}>Lo que reciben las familias de sus pacientes</h1>
              {[['🟢', 'Ven la visita en vivo', 'Saben cuándo llegó y se fue la cuidadora, y leen sus notas del día.'],
                ['💊', 'Medicinas y rutina al día', 'Todos ven qué se dio y qué falta. La app avisa si algo se olvida.'],
                ['👨‍👩‍👧', 'Toda la familia conectada', 'Hijos que viven lejos se reparten tareas y gastos.'],
                ['🚨', 'Emergencias', 'Un botón avisa a la familia y a la agencia al instante.'],
                ['⭐', 'Con su marca y su precio', `Su logo, su nombre y sus colores. Las familias se suscriben a ${b.nombre}.`]].map(([i, t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
                  <span style={{ fontSize: 24 }}>{i}</span>
                  <span><strong style={{ display: 'block', fontSize: 16 }}>{t}</strong><span style={{ fontSize: 15, color: SUB, lineHeight: 1.5 }}>{d}</span></span>
                </div>
              ))}
            </div>
          ) : (
            <div style={box}>
              <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>Ustedes ponen el precio</h1>
              <p style={{ margin: '0 0 18px', fontSize: 15, color: SUB }}>Cambie el precio y vea al lado cómo lo ven las familias en la pantalla “Plan”.</p>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: SUB, marginBottom: 6 }}>Precio por familia al mes (USD)</label>
              <input type="number" min="0" step="0.5" value={price ?? ''} onChange={e => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${LINE}`, fontSize: 22, fontWeight: 800, fontFamily: SANS, color: b.color }} />
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: SUB, margin: '18px 0 6px' }}>Familias suscritas: <strong style={{ color: INK }}>{families}</strong></label>
              <input type="range" min="5" max="500" step="5" value={families} onChange={e => setFamilies(Number(e.target.value))} style={{ width: '100%', accentColor: b.color }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
                <div style={{ background: mix(b.color, 0.88), borderRadius: 16, padding: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>Ingreso al mes</p>
                  <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: INK }}>{money(families * (price || 0))}</p>
                </div>
                <div style={{ background: mix(b.color, 0.88), borderRadius: 16, padding: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>Ingreso al año</p>
                  <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: INK }}>{money(families * (price || 0) * 12)}</p>
                </div>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13, color: SUB }}>Cálculo de ejemplo: familias × precio. No incluye costos ni comisiones.</p>
            </div>
          )}
          {['app', 'precio', 'marca'].includes(view) && <Phone key={view} brand={b} start={view === 'precio' ? 'plan' : 'inicio'} />}
        </div>
      </main>
    </div>
  )
}
