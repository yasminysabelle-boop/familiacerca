import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { ChevronLeft, CheckIcon, XIcon, AlertTriangle } from '../components/Icons'
import LoadingButton from '../components/LoadingButton'
import PatientProfileContacts from '../components/PatientProfileContacts'
import { generateMedicalReport, fetchReportData } from '../utils/generateMedicalReport'

// ── Constants ────────────────────────────────────────────────────────────────
const SANGRE     = ['A+','A-','B+','B-','O+','O-','AB+','AB-']
const ALERGIAS_P = ['Penicilina','Ibuprofeno','Aspirina','Mariscos','Látex','Polvo']
const REACCIONES = ['Anafilaxia','Urticaria','Dif. respirar','Náuseas','Hinchazón','Otra']
const CONDICION  = ['Diabetes','Hipertensión','Cardiopatía','Cáncer','Alzheimer','Parkinson','EPOC','Artritis']
const MOVILIDAD  = [
  { v:'solo',     icon:'🚶', label:'Camina solo'    },
  { v:'apoyo',    icon:'🦯', label:'Con apoyo'       },
  { v:'silla',    icon:'🦽', label:'Silla de ruedas' },
  { v:'postrado', icon:'🛏️', label:'Postrado'        },
]
const COGNITIVO  = ['Orientado','Confusión leve','Demencia','Alzheimer']
const DISPOSITIVOS = ['Lentes','Audífono','Dentadura','Prótesis','Pañal']

const EMPTY = {
  foto_url:'', nombre_completo:'', fecha_nacimiento:'', sexo:'',
  tipo_sangre:'', diagnostico_principal:'', alergias_detalle:[],
  contacto_emergencia_nombre:'', contacto_emergencia_telefono:'',
  medico_tratante:'', especialidad_medico:'', telefono_medico:'',
  especialistas:[], hospital_preferencia:'',
  condiciones_secundarias:[], antecedentes_familiares:[],
  seguro_compania:'', seguro_poliza:'', indicaciones_medico:'',
  movilidad:'', estado_cognitivo:'', usa_dispositivos:[],
  peso:'', talla:'', alimentos_acepta:'', alimentos_rechaza:'',
  rutinas_importantes:'', cosas_que_calman:'',
  historia_personal:'', gustos_hobbies:'', frases_famosas:'', miedos:'',
}

// ── Style tokens ─────────────────────────────────────────────────────────────
const F = {
  width:'100%', padding:'11px 13px', border:'1.5px solid #EDE5D8',
  borderRadius:12, fontSize:14, outline:'none', background:'#FDFAF7',
  boxSizing:'border-box', color:'#1F2937', fontFamily:'system-ui,sans-serif',
}
const L = {
  fontSize:11, fontWeight:700, color:'#6B7280',
  letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5, display:'block',
}
const fo = e => { e.target.style.borderColor='#4A7C59'; e.target.style.boxShadow='0 0 0 3px rgba(74,124,89,0.1)' }
const fb = e => { e.target.style.borderColor='#EDE5D8'; e.target.style.boxShadow='none' }

// ── Helper components ─────────────────────────────────────────────────────────
function Fld({ label, children, mb=14 }) {
  return <div style={{ marginBottom:mb }}><label style={L}>{label}</label>{children}</div>
}

function VoiceArea({ id, value, onChange, placeholder, lf, onVoice, rows=3 }) {
  return (
    <div style={{ position:'relative' }}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={rows} onFocus={fo} onBlur={fb}
        style={{ ...F, resize:'vertical', lineHeight:1.5, paddingRight:42 }} />
      <button type="button" onClick={() => onVoice(id)} style={{
        position:'absolute', top:8, right:8, width:28, height:28,
        borderRadius:8, border:'none', cursor:'pointer',
        background: lf===id ? '#D63031' : '#EBF3EE',
        fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
        transition:'background 0.15s', animation: lf===id ? 'mic-pulse 1s ease-in-out infinite' : 'none',
      }}>🎙️</button>
    </div>
  )
}

function Section({ color, icon, title, badge, open, onToggle, children }) {
  return (
    <div style={{
      borderRadius:18, border:`1.5px solid ${color}33`, background:'white',
      marginBottom:12, boxShadow:'0 2px 10px rgba(0,0,0,0.05)', overflow:'hidden',
    }}>
      <button type="button" onClick={onToggle} style={{
        width:'100%', display:'flex', alignItems:'center', gap:10,
        padding:'14px 16px', background: open ? `${color}0E` : 'white',
        border:'none', cursor:'pointer', textAlign:'left',
        borderBottom: open ? `1px solid ${color}22` : 'none',
      }}>
        <span style={{
          width:38, height:38, borderRadius:11, flexShrink:0,
          background:`${color}1A`, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:20,
        }}>{icon}</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#1A1A1A', margin:0 }}>{title}</p>
          {badge>0 && (
            <p style={{ fontSize:11, color, fontWeight:600, margin:'2px 0 0' }}>
              {badge} campo{badge!==1?'s':''} completado{badge!==1?'s':''}
            </p>
          )}
        </div>
        <span style={{
          fontSize:13, color:'#9CA3AF',
          display:'inline-block', transform: open?'rotate(180deg)':'none',
          transition:'transform 0.2s',
        }}>▾</span>
      </button>
      {open && <div style={{ padding:'16px' }}>{children}</div>}
    </div>
  )
}

function CheckChips({ opts, value, onChange, colorOn='#4A7C59', bgOn='#EBF3EE' }) {
  const toggle = o => onChange(value.includes(o) ? value.filter(x=>x!==o) : [...value, o])
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {opts.map(o => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" onClick={() => toggle(o)} style={{
            padding:'7px 13px', borderRadius:20, fontWeight:600, fontSize:13, cursor:'pointer',
            border:`1.5px solid ${on ? colorOn : '#EDE5D8'}`,
            background: on ? bgOn : 'white',
            color: on ? colorOn : '#6B7280',
            display:'flex', alignItems:'center', gap:5, transition:'all 0.15s',
          }}>
            {on && <span style={{ fontSize:11 }}>✓</span>}{o}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PatientProfile() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const navigate = useNavigate()
  const canEdit = memberRole === null || memberRole === 'cuidador'

  const [form, setForm]         = useState(EMPTY)
  const [open, setOpen]         = useState({ s1:true, s2:false, s3:false, s4:false, s5:false })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [contactBadge, setContactBadge] = useState(0)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [lf, setLf]             = useState(null)   // listening field
  const [otraAlergia, setOtraAlergia] = useState('')
  const [uploading, setUploading] = useState(false)
  const recRef  = useRef(null)
  const fileRef = useRef(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]:v }))

  useEffect(() => { if (ownerId) fetchProfile() }, [ownerId])

  async function fetchProfile() {
    setLoading(true)
    const [{ data: row }, { data: cp }] = await Promise.all([
      supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
      supabase.from('care_profiles').select('name, photo_url').eq('user_id', ownerId).maybeSingle(),
    ])

    if (row) {
      setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, row[k] ?? EMPTY[k]])),
        // legacy compat: seed alergias_detalle from old alergias text[] if needed
        alergias_detalle: row.alergias_detalle?.length
          ? row.alergias_detalle
          : (row.alergias ?? []).map(n => ({ nombre:n, reaccion:'' })),
        peso:  row.peso?.toString()  ?? '',
        talla: row.talla?.toString() ?? '',
        // Fill in name/photo from care_profiles if patient_profiles is missing them
        nombre_completo: row.nombre_completo || cp?.name || '',
        foto_url: row.foto_url || cp?.photo_url || '',
      })
    } else if (cp) {
      // patient_profiles doesn't exist yet — bootstrap from care_profiles
      setForm(prev => ({
        ...prev,
        nombre_completo: cp.name ?? '',
        foto_url: cp.photo_url ?? '',
      }))
    }
    setLoading(false)
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  function startVoice(fieldKey) {
    if (lf === fieldKey) { recRef.current?.stop(); setLf(null); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta transcripción de voz.'); return }
    recRef.current?.stop()
    const rec = new SR()
    rec.lang = 'es-MX'; rec.interimResults = false
    rec.onresult = e => {
      const t = e.results[0][0].transcript
      setForm(p => ({ ...p, [fieldKey]: p[fieldKey] ? p[fieldKey]+' '+t : t }))
    }
    rec.onend = () => setLf(null)
    rec.start(); recRef.current = rec; setLf(fieldKey)
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${ownerId}/photo.${ext}`
    const { error:upErr } = await supabase.storage
      .from('patient-photos').upload(path, file, { upsert:true })
    if (!upErr) {
      const { data:{ publicUrl } } = supabase.storage
        .from('patient-photos').getPublicUrl(path)
      set('foto_url', publicUrl)
    }
    setUploading(false)
  }

  // ── Allergy helpers ───────────────────────────────────────────────────────
  function toggleAlergia(nombre) {
    const exists = form.alergias_detalle.find(a => a.nombre===nombre)
    set('alergias_detalle', exists
      ? form.alergias_detalle.filter(a => a.nombre!==nombre)
      : [...form.alergias_detalle, { nombre, reaccion:'' }])
  }
  function setReaccion(nombre, reaccion) {
    set('alergias_detalle', form.alergias_detalle.map(a => a.nombre===nombre ? {...a, reaccion} : a))
  }
  function addOtra() {
    const n = otraAlergia.trim()
    if (!n || form.alergias_detalle.find(a => a.nombre===n)) return
    set('alergias_detalle', [...form.alergias_detalle, { nombre:n, reaccion:'' }])
    setOtraAlergia('')
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  async function handleGeneratePDF() {
    setGeneratingPDF(true)
    try {
      const data = await fetchReportData(ownerId)
      await generateMedicalReport(data, profile?.name)
    } catch (err) {
      console.error('[PDF]', err)
    } finally {
      setGeneratingPDF(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e?.preventDefault()
    setSaving(true); setError('')
    const n = v => v===''||v===null ? null : v
    const num = v => v===''||v===null ? null : Number(v)
    const arr = v => Array.isArray(v) ? v : []
    const payload = {
      owner_id:ownerId, created_by:user.id,
      foto_url: n(form.foto_url), nombre_completo: n(form.nombre_completo),
      fecha_nacimiento: n(form.fecha_nacimiento), sexo: n(form.sexo),
      tipo_sangre: n(form.tipo_sangre), diagnostico_principal: n(form.diagnostico_principal),
      alergias_detalle: arr(form.alergias_detalle),
      alergias: arr(form.alergias_detalle).map(a => a.nombre),
      contacto_emergencia_nombre: n(form.contacto_emergencia_nombre),
      contacto_emergencia_telefono: n(form.contacto_emergencia_telefono),
      medico_tratante: n(form.medico_tratante), especialidad_medico: n(form.especialidad_medico),
      telefono_medico: n(form.telefono_medico), especialistas: arr(form.especialistas),
      hospital_preferencia: n(form.hospital_preferencia),
      condiciones_secundarias: arr(form.condiciones_secundarias),
      antecedentes_familiares: arr(form.antecedentes_familiares),
      seguro_compania: n(form.seguro_compania), seguro_poliza: n(form.seguro_poliza),
      indicaciones_medico: n(form.indicaciones_medico),
      movilidad: n(form.movilidad), estado_cognitivo: n(form.estado_cognitivo),
      usa_dispositivos: arr(form.usa_dispositivos),
      peso: num(form.peso), talla: num(form.talla),
      alimentos_acepta: n(form.alimentos_acepta), alimentos_rechaza: n(form.alimentos_rechaza),
      rutinas_importantes: n(form.rutinas_importantes), cosas_que_calman: n(form.cosas_que_calman),
      historia_personal: n(form.historia_personal), gustos_hobbies: n(form.gustos_hobbies),
      frases_famosas: n(form.frases_famosas), miedos: n(form.miedos),
      updated_at: new Date().toISOString(),
    }
    const { error:err } = await supabase
      .from('patient_profiles').upsert(payload, { onConflict:'owner_id' })
    if (!err && payload.foto_url !== undefined) {
      await supabase.from('care_profiles').update({ photo_url: payload.foto_url }).eq('user_id', ownerId)
    }
    if (err) setError('No se pudo guardar: '+err.message)
    else { setSuccess(true); setTimeout(()=>setSuccess(false), 3000) }
    setSaving(false)
  }

  // ── Badge counts ──────────────────────────────────────────────────────────
  const b = keys => keys.filter(k => { const v=form[k]; return Array.isArray(v)?v.length>0:!!v }).length
  const b1 = b(['nombre_completo','fecha_nacimiento','sexo','tipo_sangre'])
  const b2 = b(['diagnostico_principal','alergias_detalle','condiciones_secundarias','seguro_compania','indicaciones_medico','antecedentes_familiares'])
  const b3 = b(['movilidad','estado_cognitivo','usa_dispositivos','peso','alimentos_acepta','rutinas_importantes','cosas_que_calman'])
  const b4 = contactBadge
  const b5 = b(['historia_personal','gustos_hobbies','frases_famosas','miedos'])

  const initials = form.nombre_completo.trim().split(' ').filter(Boolean)
    .slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <style>{`
        @keyframes mic-pulse {
          0%,100% { box-shadow:0 0 0 0 rgba(214,48,49,0.4); }
          50%      { box-shadow:0 0 0 6px rgba(214,48,49,0); }
        }
      `}</style>

      {success && (
        <div style={{
          position:'fixed', top:64, left:'50%', transform:'translateX(-50%)',
          zIndex:100, background:'#15803D', color:'white',
          borderRadius:14, padding:'12px 20px',
          boxShadow:'0 8px 32px rgba(0,0,0,0.2)',
          fontSize:14, fontWeight:600, whiteSpace:'nowrap',
        }}>✓ Perfil guardado correctamente</div>
      )}

      <div style={{ paddingBottom:100 }}>
        {/* ── Header ── */}
        <div style={{
          background:'linear-gradient(135deg, #4A7C59 0%, #2E5240 100%)',
          padding:'20px 16px 32px',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <button onClick={() => navigate(-1)} style={{
              width:36, height:36, borderRadius:'50%',
              background:'rgba(255,255,255,0.15)', border:'none',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <ChevronLeft size={18} color="white" strokeWidth={2} />
            </button>
            <div style={{ flex:1 }}>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:12, margin:0 }}>Información clínica</p>
              <h1 style={{ color:'white', fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, margin:'2px 0 0' }}>
                {form.nombre_completo ? `Perfil de ${form.nombre_completo.split(' ')[0]}` : 'Perfil del Paciente'}
              </h1>
            </div>
          </div>

          {/* Photo + name */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <div
                onClick={() => canEdit && fileRef.current?.click()}
                style={{
                  width:68, height:68, borderRadius:'50%',
                  border:'3px solid rgba(255,255,255,0.4)', overflow:'hidden',
                  cursor: canEdit?'pointer':'default',
                  background: form.foto_url ? 'transparent' : 'rgba(255,255,255,0.2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                {form.foto_url
                  ? <img src={form.foto_url} alt="Paciente" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ color:'white', fontSize:22, fontWeight:700 }}>{initials}</span>
                }
                {uploading && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'white', fontSize:11 }}>...</span>
                  </div>
                )}
              </div>
              {canEdit && (
                <div onClick={() => fileRef.current?.click()} style={{
                  position:'absolute', bottom:0, right:0, width:22, height:22,
                  borderRadius:'50%', background:'white', border:'2px solid #4A7C59',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, cursor:'pointer',
                }}>📷</div>
              )}
            </div>
            <div>
              <p style={{ color:'white', fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, margin:0 }}>
                {loading ? '...' : (form.nombre_completo || 'Sin nombre registrado')}
              </p>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:12, margin:'4px 0 0' }}>
                {form.fecha_nacimiento
                  ? new Date(form.fecha_nacimiento+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})
                  : 'Fecha sin registrar'}
                {form.sexo === 'masculino' ? ' · ♂ Masculino' : form.sexo === 'femenino' ? ' · ♀ Femenino' : ''}
                {form.tipo_sangre ? ` · ${form.tipo_sangre}` : ''}
              </p>
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />

        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF', fontSize:14 }}>Cargando perfil...</div>
        ) : (
          <form onSubmit={handleSave} style={{ padding:'16px 16px 0' }}>

            {/* ══ S1: Información básica ═══════════════════════════════════ */}
            <Section color="#4A7C59" icon="📋" title="Información básica" badge={b1}
              open={open.s1} onToggle={() => setOpen(p=>({...p,s1:!p.s1}))}>

              <Fld label="Nombre completo">
                <input value={form.nombre_completo}
                  onChange={e=>set('nombre_completo',e.target.value)}
                  placeholder="Ej. María López García"
                  style={F} onFocus={fo} onBlur={fb} />
              </Fld>

              <Fld label="Fecha de nacimiento">
                <input type="date" value={form.fecha_nacimiento}
                  onChange={e=>set('fecha_nacimiento',e.target.value)}
                  style={F} onFocus={fo} onBlur={fb} />
              </Fld>

              <Fld label="Sexo">
                <div style={{ display:'flex', gap:10 }}>
                  {[{v:'masculino',label:'♂ Masculino'},{v:'femenino',label:'♀ Femenino'}].map(o => (
                    <button key={o.v} type="button"
                      onClick={() => set('sexo', form.sexo===o.v ? '' : o.v)}
                      style={{
                        flex:1, padding:'12px 0', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer',
                        border:`1.5px solid ${form.sexo===o.v ? '#4A7C59' : '#EDE5D8'}`,
                        background: form.sexo===o.v ? '#EBF3EE' : 'white',
                        color: form.sexo===o.v ? '#2E5240' : '#6B7280',
                        transition:'all 0.15s',
                      }}>{o.label}</button>
                  ))}
                </div>
              </Fld>

              <Fld label="Tipo de sangre">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {SANGRE.map(s => {
                    const on = form.tipo_sangre===s
                    return (
                      <button key={s} type="button" onClick={() => set('tipo_sangre', on?'':s)} style={{
                        padding:'8px 14px', borderRadius:20, fontWeight:700, fontSize:13, cursor:'pointer',
                        border:`1.5px solid ${on ? '#D63031' : '#EDE5D8'}`,
                        background: on ? '#FFF0F0' : 'white',
                        color: on ? '#D63031' : '#6B7280',
                        transition:'all 0.15s',
                      }}>{s}</button>
                    )
                  })}
                </div>
              </Fld>
            </Section>

            {/* ══ S2: Información médica ════════════════════════════════════ */}
            <Section color="#2563EB" icon="🏥" title="Información médica" badge={b2}
              open={open.s2} onToggle={() => setOpen(p=>({...p,s2:!p.s2}))}>

              <Fld label="Diagnóstico principal">
                <VoiceArea id="diagnostico_principal" value={form.diagnostico_principal}
                  onChange={v=>set('diagnostico_principal',v)}
                  placeholder="Ej. Alzheimer grado moderado, hipertensión arterial..."
                  lf={lf} onVoice={startVoice} />
              </Fld>

              <Fld label="⚠ Alergias críticas">
                {/* Preset chips */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                  {ALERGIAS_P.map(a => {
                    const on = !!form.alergias_detalle.find(x=>x.nombre===a)
                    return (
                      <button key={a} type="button" onClick={() => toggleAlergia(a)} style={{
                        padding:'7px 13px', borderRadius:20, fontWeight:600, fontSize:13, cursor:'pointer',
                        border:`1.5px solid ${on ? '#D63031' : '#EDE5D8'}`,
                        background: on ? '#FFF0F0' : 'white',
                        color: on ? '#D63031' : '#6B7280', transition:'all 0.15s',
                      }}>{on?'⚠ ':''}{a}</button>
                    )
                  })}
                </div>
                {/* Active allergies with reaction */}
                {form.alergias_detalle.map(a => (
                  <div key={a.nombre} style={{
                    display:'flex', alignItems:'center', gap:8, marginBottom:8,
                    padding:'8px 12px', background:'#FFF8F8', borderRadius:10, border:'1px solid #FFCDD2',
                  }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#D63031', flex:1 }}>⚠ {a.nombre}</span>
                    <select value={a.reaccion} onChange={e=>setReaccion(a.nombre,e.target.value)} style={{
                      fontSize:12, border:'1px solid #EDE5D8', borderRadius:8,
                      padding:'5px 8px', background:'white', color:'#374151', outline:'none',
                    }}>
                      <option value="">Reacción...</option>
                      {REACCIONES.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                    <button type="button" onClick={() => toggleAlergia(a.nombre)} style={{
                      background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:16, padding:'0 2px',
                    }}>✕</button>
                  </div>
                ))}
                {/* Custom allergy */}
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <input value={otraAlergia} onChange={e=>setOtraAlergia(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addOtra()}}}
                    placeholder="Otra alergia..." style={{ ...F, flex:1 }} onFocus={fo} onBlur={fb} />
                  <button type="button" onClick={addOtra} style={{
                    padding:'0 16px', borderRadius:12, border:'none', background:'#D63031',
                    color:'white', fontWeight:700, fontSize:20, cursor:'pointer', flexShrink:0,
                  }}>+</button>
                </div>
              </Fld>

              <Fld label="Condiciones secundarias">
                <CheckChips opts={CONDICION} value={form.condiciones_secundarias}
                  onChange={v=>set('condiciones_secundarias',v)} />
              </Fld>

              <Fld label="Antecedentes familiares">
                <CheckChips opts={CONDICION} value={form.antecedentes_familiares}
                  onChange={v=>set('antecedentes_familiares',v)} colorOn="#7C3AED" bgOn="#F5F3FF" />
              </Fld>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Fld label="Seguro médico">
                  <input value={form.seguro_compania} onChange={e=>set('seguro_compania',e.target.value)}
                    placeholder="Compañía" style={F} onFocus={fo} onBlur={fb} />
                </Fld>
                <Fld label="No. póliza">
                  <input value={form.seguro_poliza} onChange={e=>set('seguro_poliza',e.target.value)}
                    placeholder="Número" style={F} onFocus={fo} onBlur={fb} />
                </Fld>
              </div>

              <Fld label="Indicaciones especiales del médico" mb={0}>
                <VoiceArea id="indicaciones_medico" value={form.indicaciones_medico}
                  onChange={v=>set('indicaciones_medico',v)}
                  placeholder="Restricciones, instrucciones especiales..."
                  lf={lf} onVoice={startVoice} />
              </Fld>
            </Section>

            {/* ── Botón Reporte PDF ───────────────────────────────────────── */}
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={generatingPDF}
              style={{
                width: '100%', marginBottom: 12, padding: '13px 16px',
                borderRadius: 16, border: '1.5px solid #2D4A1E',
                background: generatingPDF ? '#F0F9F4' : 'white',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: generatingPDF ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(45,74,30,0.08)',
              }}
            >
              <span style={{ fontSize: 20 }}>{generatingPDF ? '⏳' : '📄'}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#2D4A1E', margin: 0 }}>
                  {generatingPDF ? 'Generando reporte...' : 'Generar reporte PDF'}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>
                  Medicamentos, directorio, notas y citas
                </p>
              </div>
              {!generatingPDF && <span style={{ color: '#4A7C59', fontSize: 16 }}>↓</span>}
            </button>

            {/* ══ S3: Preferencias ═══════════════════════════════════════════ */}
            <Section color="#EA8C00" icon="⭐" title="Preferencias" badge={b3}
              open={open.s3} onToggle={() => setOpen(p=>({...p,s3:!p.s3}))}>

              <Fld label="Movilidad">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {MOVILIDAD.map(m => {
                    const on = form.movilidad===m.v
                    return (
                      <button key={m.v} type="button" onClick={() => set('movilidad', on?'':m.v)} style={{
                        padding:'12px 8px', borderRadius:14, cursor:'pointer', textAlign:'center',
                        border:`1.5px solid ${on ? '#EA8C00' : '#EDE5D8'}`,
                        background: on ? '#FFFBEB' : 'white',
                        color: on ? '#7C5000' : '#6B7280',
                        fontWeight:600, fontSize:13, transition:'all 0.15s',
                      }}>
                        <div style={{ fontSize:22, marginBottom:4 }}>{m.icon}</div>
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </Fld>

              <Fld label="Estado cognitivo">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {COGNITIVO.map(c => {
                    const on = form.estado_cognitivo===c
                    return (
                      <button key={c} type="button" onClick={() => set('estado_cognitivo', on?'':c)} style={{
                        padding:'8px 14px', borderRadius:20, fontWeight:600, fontSize:13, cursor:'pointer',
                        border:`1.5px solid ${on ? '#EA8C00' : '#EDE5D8'}`,
                        background: on ? '#FFFBEB' : 'white',
                        color: on ? '#7C5000' : '#6B7280', transition:'all 0.15s',
                      }}>{c}</button>
                    )
                  })}
                </div>
              </Fld>

              <Fld label="Usa">
                <CheckChips opts={DISPOSITIVOS} value={form.usa_dispositivos}
                  onChange={v=>set('usa_dispositivos',v)} colorOn="#EA8C00" bgOn="#FFFBEB" />
              </Fld>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Fld label="Peso (kg)">
                  <input type="number" value={form.peso} onChange={e=>set('peso',e.target.value)}
                    placeholder="65" style={F} onFocus={fo} onBlur={fb} />
                </Fld>
                <Fld label="Talla (cm)">
                  <input type="number" value={form.talla} onChange={e=>set('talla',e.target.value)}
                    placeholder="165" style={F} onFocus={fo} onBlur={fb} />
                </Fld>
              </div>

              <Fld label="Alimentos que acepta">
                <VoiceArea id="alimentos_acepta" value={form.alimentos_acepta}
                  onChange={v=>set('alimentos_acepta',v)}
                  placeholder="Sopas suaves, frutas blandas, purés..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>

              <Fld label="Alimentos que rechaza">
                <VoiceArea id="alimentos_rechaza" value={form.alimentos_rechaza}
                  onChange={v=>set('alimentos_rechaza',v)}
                  placeholder="Picante, mariscos, texturas difíciles..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>

              <Fld label="Rutinas importantes">
                <VoiceArea id="rutinas_importantes" value={form.rutinas_importantes}
                  onChange={v=>set('rutinas_importantes',v)}
                  placeholder="Siesta a las 2pm, paseo vespertino, oraciones antes de dormir..."
                  lf={lf} onVoice={startVoice} />
              </Fld>

              <Fld label="Cosas que lo calman" mb={0}>
                <VoiceArea id="cosas_que_calman" value={form.cosas_que_calman}
                  onChange={v=>set('cosas_que_calman',v)}
                  placeholder="Música clásica, ver fotos familiares, sostener la mano..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>
            </Section>

            {/* ══ S4: Contactos ════════════════════════════════════════════ */}
            <Section color="#0891B2" icon="📒" title="Directorio" badge={b4}
              open={open.s4} onToggle={() => setOpen(p=>({...p,s4:!p.s4}))}>
              <PatientProfileContacts
                ownerId={ownerId}
                canEdit={canEdit}
                initialForm={form}
                onBadgeChange={setContactBadge}
              />
            </Section>

            {/* ══ S5: Historia personal ════════════════════════════════════ */}
            <Section color="#7C3AED" icon="📖" title="Historia personal" badge={b5}
              open={open.s5} onToggle={() => setOpen(p=>({...p,s5:!p.s5}))}>

              <p style={{ fontSize:13, color:'#9CA3AF', margin:'0 0 16px', lineHeight:1.5 }}>
                Ayuda a los cuidadores a conocer a la persona más allá de su condición médica.
              </p>

              <Fld label="¿Quién es? Historia de vida">
                <VoiceArea id="historia_personal" value={form.historia_personal}
                  onChange={v=>set('historia_personal',v)}
                  placeholder="Profesión, familia, logros, lugares donde vivió, momentos importantes..."
                  lf={lf} onVoice={startVoice} rows={4} />
              </Fld>

              <Fld label="Gustos y hobbies">
                <VoiceArea id="gustos_hobbies" value={form.gustos_hobbies}
                  onChange={v=>set('gustos_hobbies',v)}
                  placeholder="Le encantaba cocinar, bailar salsa, leer novelas de misterio..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>

              <Fld label="Frases o palabras especiales">
                <VoiceArea id="frases_famosas" value={form.frases_famosas}
                  onChange={v=>set('frases_famosas',v)}
                  placeholder="Palabras que usa, apodos, frases que repite con frecuencia..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>

              <Fld label="Miedos o cosas que lo angustian" mb={0}>
                <VoiceArea id="miedos" value={form.miedos}
                  onChange={v=>set('miedos',v)}
                  placeholder="Para que los cuidadores puedan anticipar situaciones difíciles..."
                  lf={lf} onVoice={startVoice} rows={2} />
              </Fld>
            </Section>

            {error && (
              <div style={{
                padding:'12px 14px', background:'#FFF0F0', border:'1px solid #FFBABA',
                borderRadius:12, fontSize:13, color:'#D63031', marginBottom:12,
                display:'flex', gap:8, alignItems:'flex-start',
              }}>
                <AlertTriangle size={15} color="#D63031" strokeWidth={2} style={{ flexShrink:0, marginTop:1 }} />
                {error}
              </div>
            )}

            {canEdit && (
              <LoadingButton
                type="submit"
                loading={saving}
                loadingText="Guardando..."
                style={{ width: '100%', padding: '15px', fontSize: 15, marginBottom: 16 }}
              >
                <CheckIcon size={17} color="white" strokeWidth={2.5} />
                Guardar perfil del paciente
              </LoadingButton>
            )}
          </form>
        )}
      </div>
    </Layout>
  )
}
