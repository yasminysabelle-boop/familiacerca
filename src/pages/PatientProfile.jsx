import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  User, ChevronLeft, Pencil, CheckIcon, XIcon,
  AlertTriangle, Phone, BookOpen, Heart,
} from '../components/Icons'

const SEXO_OPTS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino',  label: 'Femenino'  },
  { value: 'otro',      label: 'Otro'       },
]

const fieldBase = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #EDE5D8', borderRadius: 12,
  fontSize: 14, outline: 'none', background: '#FDFAF7',
  boxSizing: 'border-box', color: '#1F2937',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#6B7280', letterSpacing: '0.08em',
  textTransform: 'uppercase', marginBottom: 6,
}
const sectionTitle = {
  fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700,
  color: '#1A1A1A', marginBottom: 14, marginTop: 24,
  display: 'flex', alignItems: 'center', gap: 8,
}

function TagInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v) return
    if (!value.includes(v)) onChange([...value, v])
    setInput('')
  }
  function remove(item) { onChange(value.filter(x => x !== item)) }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          style={{ ...fieldBase, flex: 1 }}
          onFocus={e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }}
          onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            padding: '0 16px', borderRadius: 12, border: 'none',
            background: '#4A7C59', color: 'white', fontWeight: 700,
            fontSize: 20, cursor: 'pointer', flexShrink: 0,
          }}
        >+</button>
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map(item => (
            <span key={item} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 20,
              background: '#EBF3EE', color: '#2E5240',
              fontSize: 13, fontWeight: 600,
            }}>
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                <XIcon size={12} color="#4A7C59" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function ViewRow({ label, value, empty = 'No registrado' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>
        {label}
      </p>
      <p style={{ fontSize: 14, color: value ? '#1F2937' : '#C9B99A', margin: 0, fontStyle: value ? 'normal' : 'italic' }}>
        {value || empty}
      </p>
    </div>
  )
}

function TagList({ items }) {
  if (!items?.length) return <p style={{ fontSize: 14, color: '#C9B99A', fontStyle: 'italic', margin: 0 }}>No registrado</p>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {items.map(item => (
        <span key={item} style={{
          padding: '4px 10px', borderRadius: 20,
          background: '#EBF3EE', color: '#2E5240',
          fontSize: 13, fontWeight: 600,
        }}>{item}</span>
      ))}
    </div>
  )
}

export default function PatientProfile() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const navigate = useNavigate()

  const canEdit = memberRole === null || memberRole === 'cuidador'

  const [data, setData]       = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    nombre_completo: '',
    fecha_nacimiento: '',
    sexo: '',
    diagnostico_principal: '',
    condiciones_secundarias: [],
    alergias: [],
    medico_tratante: '',
    especialidad_medico: '',
    telefono_medico: '',
    notas_generales: '',
  })

  useEffect(() => {
    if (ownerId) fetchProfile()
  }, [ownerId])

  async function fetchProfile() {
    setLoading(true)
    const { data: row } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle()
    setData(row ?? null)
    if (row) {
      setForm({
        nombre_completo: row.nombre_completo ?? '',
        fecha_nacimiento: row.fecha_nacimiento ?? '',
        sexo: row.sexo ?? '',
        diagnostico_principal: row.diagnostico_principal ?? '',
        condiciones_secundarias: row.condiciones_secundarias ?? [],
        alergias: row.alergias ?? [],
        medico_tratante: row.medico_tratante ?? '',
        especialidad_medico: row.especialidad_medico ?? '',
        telefono_medico: row.telefono_medico ?? '',
        notas_generales: row.notas_generales ?? '',
      })
    }
    setLoading(false)
  }

  function startEdit() {
    if (data) {
      setForm({
        nombre_completo: data.nombre_completo ?? '',
        fecha_nacimiento: data.fecha_nacimiento ?? '',
        sexo: data.sexo ?? '',
        diagnostico_principal: data.diagnostico_principal ?? '',
        condiciones_secundarias: data.condiciones_secundarias ?? [],
        alergias: data.alergias ?? [],
        medico_tratante: data.medico_tratante ?? '',
        especialidad_medico: data.especialidad_medico ?? '',
        telefono_medico: data.telefono_medico ?? '',
        notas_generales: data.notas_generales ?? '',
      })
    }
    setEditing(true)
    setError('')
  }

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      owner_id: ownerId,
      created_by: user.id,
      nombre_completo: form.nombre_completo || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      sexo: form.sexo || null,
      diagnostico_principal: form.diagnostico_principal || null,
      condiciones_secundarias: form.condiciones_secundarias,
      alergias: form.alergias,
      medico_tratante: form.medico_tratante || null,
      especialidad_medico: form.especialidad_medico || null,
      telefono_medico: form.telefono_medico || null,
      notas_generales: form.notas_generales || null,
    }
    const { data: saved, error: err } = await supabase
      .from('patient_profiles')
      .upsert(payload, { onConflict: 'owner_id' })
      .select()
      .single()
    if (err) {
      setError('No se pudo guardar: ' + err.message)
    } else {
      setData(saved)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  const inputFocus = e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
  const inputBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

  const patientName = data?.nombre_completo || 'Paciente'

  return (
    <Layout>
      {success && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#15803D', color: 'white',
          borderRadius: 14, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          ✓ Perfil guardado correctamente
        </div>
      )}

      <div style={{ padding: '0 0 96px' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4A7C59 0%, #2E5240 100%)',
          padding: '20px 16px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={18} color="white" strokeWidth={2} />
            </button>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: 0 }}>
                Información clínica
              </p>
              <h1 style={{
                color: 'white', fontFamily: 'Georgia, serif',
                fontSize: 20, fontWeight: 700, margin: '2px 0 0',
              }}>
                Perfil del Paciente
              </h1>
            </div>
            {canEdit && !editing && !loading && (
              <button
                onClick={startEdit}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                  color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                <Pencil size={14} color="white" strokeWidth={2} />
                Editar
              </button>
            )}
          </div>

          {/* Avatar + nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={26} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ color: 'white', fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {loading ? '...' : (data?.nombre_completo || 'Sin nombre registrado')}
              </p>
              {data?.fecha_nacimiento && (
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '3px 0 0' }}>
                  {new Date(data.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {data.sexo ? ` · ${data.sexo.charAt(0).toUpperCase() + data.sexo.slice(1)}` : ''}
                </p>
              )}
              {!data && !loading && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '3px 0 0' }}>
                  {canEdit ? 'Toca Editar para completar el perfil' : 'Perfil sin completar'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              Cargando perfil...
            </div>
          ) : editing ? (
            /* ── EDIT FORM ── */
            <form onSubmit={handleSave}>
              <p style={{ ...sectionTitle, marginTop: 20 }}>
                <User size={16} color="#4A7C59" strokeWidth={1.75} />
                Datos personales
              </p>

              <Field label="Nombre completo">
                <input
                  value={form.nombre_completo}
                  onChange={e => set('nombre_completo', e.target.value)}
                  placeholder="Ej. María López García"
                  style={fieldBase}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </Field>

              <Field label="Fecha de nacimiento">
                <input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={e => set('fecha_nacimiento', e.target.value)}
                  style={fieldBase}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </Field>

              <Field label="Sexo">
                <div style={{ display: 'flex', gap: 10 }}>
                  {SEXO_OPTS.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set('sexo', form.sexo === o.value ? '' : o.value)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 12,
                        border: `1.5px solid ${form.sexo === o.value ? '#4A7C59' : '#EDE5D8'}`,
                        background: form.sexo === o.value ? '#EBF3EE' : 'white',
                        color: form.sexo === o.value ? '#2E5240' : '#6B7280',
                        fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>

              <p style={sectionTitle}>
                <Heart size={16} color="#D63031" strokeWidth={1.75} />
                Diagnósticos y condiciones
              </p>

              <Field label="Diagnóstico principal">
                <textarea
                  value={form.diagnostico_principal}
                  onChange={e => set('diagnostico_principal', e.target.value)}
                  placeholder="Ej. Alzheimer grado moderado, hipertensión arterial..."
                  rows={3}
                  style={{ ...fieldBase, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </Field>

              <Field label="Condiciones secundarias (Enter para agregar)">
                <TagInput
                  value={form.condiciones_secundarias}
                  onChange={v => set('condiciones_secundarias', v)}
                  placeholder="Ej. Diabetes tipo 2"
                />
              </Field>

              <Field label="Alergias (Enter para agregar)">
                <TagInput
                  value={form.alergias}
                  onChange={v => set('alergias', v)}
                  placeholder="Ej. Penicilina, ibuprofeno..."
                />
              </Field>

              <p style={sectionTitle}>
                <Phone size={16} color="#2563EB" strokeWidth={1.75} />
                Médico tratante
              </p>

              <Field label="Nombre del médico">
                <input
                  value={form.medico_tratante}
                  onChange={e => set('medico_tratante', e.target.value)}
                  placeholder="Dr. / Dra."
                  style={fieldBase}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Especialidad">
                  <input
                    value={form.especialidad_medico}
                    onChange={e => set('especialidad_medico', e.target.value)}
                    placeholder="Ej. Geriatría"
                    style={fieldBase}
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    value={form.telefono_medico}
                    onChange={e => set('telefono_medico', e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    type="tel"
                    style={fieldBase}
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </Field>
              </div>

              <p style={sectionTitle}>
                <BookOpen size={16} color="#C9882A" strokeWidth={1.75} />
                Notas generales
              </p>

              <Field label="Observaciones adicionales">
                <textarea
                  value={form.notas_generales}
                  onChange={e => set('notas_generales', e.target.value)}
                  placeholder="Indicaciones especiales, preferencias del paciente, restricciones de movilidad..."
                  rows={4}
                  style={{ ...fieldBase, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </Field>

              {error && (
                <div style={{
                  padding: '12px 14px', background: '#FFF0F0',
                  border: '1px solid #FFBABA', borderRadius: 12,
                  fontSize: 13, color: '#D63031', marginBottom: 16,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <AlertTriangle size={16} color="#D63031" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 16,
                    border: '1.5px solid #EDE5D8', background: 'white',
                    color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2, padding: '14px', borderRadius: 16, border: 'none',
                    background: saving ? '#C0CCC5' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 6px 20px rgba(74,124,89,0.3)',
                  }}
                >
                  {saving ? 'Guardando...' : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <CheckIcon size={16} color="white" strokeWidth={2.5} />
                      Guardar perfil
                    </span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ── VIEW MODE ── */
            <div>
              {!data && canEdit && (
                <div style={{
                  marginTop: 20, padding: '20px',
                  background: 'linear-gradient(135deg, #EBF3EE, #D4EDE0)',
                  borderRadius: 16, border: '1.5px solid #A8D5B8',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#2E5240', margin: '0 0 6px' }}>
                    El perfil del paciente está vacío
                  </p>
                  <p style={{ fontSize: 13, color: '#4A7C59', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Agrega información médica clave para que toda la familia pueda consultarla.
                  </p>
                  <button
                    onClick={startEdit}
                    style={{
                      padding: '12px 24px', borderRadius: 14, border: 'none',
                      background: '#4A7C59', color: 'white', fontWeight: 700,
                      fontSize: 14, cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(74,124,89,0.3)',
                    }}
                  >
                    Completar perfil →
                  </button>
                </div>
              )}

              {!data && !canEdit && (
                <div style={{
                  marginTop: 20, padding: '20px',
                  background: '#F9FAFB', borderRadius: 16,
                  border: '1px solid #EDE5D8', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
                    El perfil del paciente aún no ha sido completado.
                  </p>
                </div>
              )}

              {data && (
                <div>
                  {/* Datos personales */}
                  <p style={{ ...sectionTitle, marginTop: 20 }}>
                    <User size={16} color="#4A7C59" strokeWidth={1.75} />
                    Datos personales
                  </p>
                  <div style={{
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8', padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <ViewRow label="Nombre completo" value={data.nombre_completo} />
                    <ViewRow
                      label="Fecha de nacimiento"
                      value={data.fecha_nacimiento
                        ? new Date(data.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null}
                    />
                    <ViewRow
                      label="Sexo"
                      value={data.sexo ? data.sexo.charAt(0).toUpperCase() + data.sexo.slice(1) : null}
                    />
                  </div>

                  {/* Diagnósticos */}
                  <p style={{ ...sectionTitle }}>
                    <Heart size={16} color="#D63031" strokeWidth={1.75} />
                    Diagnósticos y condiciones
                  </p>
                  <div style={{
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8', padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <ViewRow label="Diagnóstico principal" value={data.diagnostico_principal} />
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                        Condiciones secundarias
                      </p>
                      <TagList items={data.condiciones_secundarias} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#E53E3E', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                        ⚠ Alergias
                      </p>
                      {data.alergias?.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {data.alergias.map(item => (
                            <span key={item} style={{
                              padding: '4px 10px', borderRadius: 20,
                              background: '#FFF0F0', color: '#D63031',
                              fontSize: 13, fontWeight: 600,
                              border: '1px solid #FFBABA',
                            }}>{item}</span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 14, color: '#C9B99A', fontStyle: 'italic', margin: 0 }}>Sin alergias registradas</p>
                      )}
                    </div>
                  </div>

                  {/* Médico */}
                  <p style={sectionTitle}>
                    <Phone size={16} color="#2563EB" strokeWidth={1.75} />
                    Médico tratante
                  </p>
                  <div style={{
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8', padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <ViewRow label="Nombre" value={data.medico_tratante} />
                    <ViewRow label="Especialidad" value={data.especialidad_medico} />
                    {data.telefono_medico ? (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>
                          Teléfono
                        </p>
                        <a
                          href={`tel:${data.telefono_medico}`}
                          style={{
                            fontSize: 14, color: '#2563EB', textDecoration: 'none',
                            fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Phone size={14} color="#2563EB" strokeWidth={2} />
                          {data.telefono_medico}
                        </a>
                      </div>
                    ) : (
                      <ViewRow label="Teléfono" value={null} />
                    )}
                  </div>

                  {/* Notas */}
                  {data.notas_generales && (
                    <>
                      <p style={sectionTitle}>
                        <BookOpen size={16} color="#C9882A" strokeWidth={1.75} />
                        Notas generales
                      </p>
                      <div style={{
                        background: '#FFFBEB', borderRadius: 16,
                        border: '1px solid #FDE68A', padding: '16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}>
                        <p style={{ fontSize: 14, color: '#78350F', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                          {data.notas_generales}
                        </p>
                      </div>
                    </>
                  )}

                  {canEdit && (
                    <button
                      onClick={startEdit}
                      style={{
                        width: '100%', marginTop: 24, padding: '14px',
                        borderRadius: 16, border: '1.5px solid #4A7C59',
                        background: 'white', color: '#4A7C59',
                        fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <Pencil size={15} color="#4A7C59" strokeWidth={2} />
                      Editar perfil del paciente
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
