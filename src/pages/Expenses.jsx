import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { ChevronLeft, ChevronRight, Plus, XIcon, Camera } from '../components/Icons'
import { track } from '../lib/analytics'

const CATEGORIES = [
  { id: 'Medicamentos',    emoji: '💊', color: '#C4623A' },
  { id: 'Citas médicas',   emoji: '🏥', color: '#2D86A0' },
  { id: 'Transporte',      emoji: '🚗', color: '#4A7C59' },
  { id: 'Cuidador',        emoji: '🤝', color: '#7C5CBF' },
  { id: 'Equipos médicos', emoji: '🩺', color: '#D4A853' },
  { id: 'Otros',           emoji: '📋', color: '#9CA3AF' },
]

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function formatCurrency(n) {
  return new Intl.NumberFormat('es-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

const catFor = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[5]

export default function Expenses() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email ?? ''

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [expenses, setExpenses] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    amount: '', category: 'Medicamentos', description: '',
    paid_by: displayName, date: now.toISOString().slice(0, 10),
  })
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { loadExpenses() }, [year, month])

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openModal()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  async function loadExpenses() {
    setLoading(true)
    const mm   = String(month + 1).padStart(2, '0')
    const from = `${year}-${mm}-01`
    const last = new Date(year, month + 1, 0).getDate()
    const to   = `${year}-${mm}-${String(last).padStart(2, '0')}`

    const { data } = await supabase
      .from('care_expenses')
      .select('*')
      .eq('user_id', ownerId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    setExpenses(data ?? [])
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function openModal() {
    setForm({
      amount: '', category: 'Medicamentos', description: '',
      paid_by: displayName, date: new Date().toISOString().slice(0, 10),
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setSaveError('')
    setShowModal(true)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    let receipt_photo_url = null

    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${user.id}/expenses/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('confirmations')
        .upload(path, photoFile, { contentType: photoFile.type })

      if (uploadErr) {
        setSaveError('El recibo no se pudo subir. El gasto se guardará sin foto.')
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('confirmations').getPublicUrl(path)
        receipt_photo_url = publicUrl
      }
    }

    const { error } = await supabase.from('care_expenses').insert({
      user_id:           ownerId,
      amount:            parseFloat(form.amount),
      category:          form.category,
      description:       form.description.trim() || null,
      paid_by:           form.paid_by.trim() || displayName,
      date:              form.date,
      receipt_photo_url,
    })

    setSaving(false)

    if (error) {
      setSaveError('Error al guardar: ' + error.message)
      return
    }

    track('expense_added', { category: form.category, amount: parseFloat(form.amount) })
    setShowModal(false)
    loadExpenses()
  }

  async function handleDelete(id) {
    await supabase.from('care_expenses').delete().eq('id', id).eq('user_id', ownerId)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  const catMap = {}
  for (const e of expenses) catMap[e.category] = (catMap[e.category] ?? 0) + parseFloat(e.amount)
  const categoryTotals = CATEGORIES
    .map(c => ({ ...c, subtotal: catMap[c.id] ?? 0 }))
    .filter(c => c.subtotal > 0)
    .sort((a, b) => b.subtotal - a.subtotal)
  const maxCat = categoryTotals[0]?.subtotal ?? 1

  const fieldStyle = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid #EDE5D8', borderRadius: 12,
    fontSize: 14, outline: 'none', background: 'white',
    boxSizing: 'border-box', color: '#1A1A1A', transition: 'all 0.15s',
  }
  const onFocus = e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }
  const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

  const canSave = !saving && !!form.amount && !!form.paid_by.trim()

  return (
    <Layout>
      <div style={{ paddingBottom: 96 }}>

        {/* Month navigator */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '16px 20px 12px',
        }}>
          <button
            onClick={prevMonth}
            style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft size={18} color="#6B7280" strokeWidth={2} />
          </button>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A' }}>
            {MONTH_NAMES[month]} {year}
          </p>
          <button
            onClick={nextMonth}
            style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}
          >
            <ChevronRight size={18} color="#6B7280" strokeWidth={2} />
          </button>
        </div>

        {/* Total card */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: 'linear-gradient(145deg, #BF5E37 0%, #7A3418 100%)',
            borderRadius: 22, padding: '22px 24px',
            boxShadow: '0 8px 28px rgba(196,98,58,0.28)',
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              Total del mes
            </p>
            <p style={{
              color: 'white', fontSize: 38, fontWeight: 800,
              lineHeight: 1, marginBottom: 6, fontFamily: 'Georgia, serif',
            }}>
              {loading ? '—' : formatCurrency(total)}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
              {!loading && `${expenses.length} gasto${expenses.length !== 1 ? 's' : ''} registrado${expenses.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        {!loading && categoryTotals.length > 0 && (
          <div style={{
            margin: '0 20px 16px', background: 'white',
            borderRadius: 18, padding: '16px 18px',
            border: '1px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: '#6B7280',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>
              Por categoría
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categoryTotals.map(c => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{c.emoji} {c.id}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                      {formatCurrency(c.subtotal)}
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: c.color,
                      width: `${(c.subtotal / maxCat) * 100}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense list */}
        <div style={{ padding: '0 20px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
              Cargando...
            </p>
          ) : expenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
              <p style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                color: '#1A1A1A', marginBottom: 6,
              }}>
                Sin gastos este mes
              </p>
              <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
                Toca el botón + para registrar el primer gasto del mes.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {expenses.map(expense => {
                const c = catFor(expense.category)
                return (
                  <div key={expense.id} style={{
                    background: 'white', borderRadius: 16,
                    padding: '13px 14px',
                    border: '1px solid #EDE5D8',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {/* Category emoji */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                      background: `${c.color}14`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      {c.emoji}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, color: '#1A1A1A',
                        marginBottom: 2, fontFamily: 'Georgia, serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {expense.description || expense.category}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {expense.paid_by} · {formatDate(expense.date)}
                      </p>
                    </div>

                    {/* Amount + delete */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>
                        {formatCurrency(expense.amount)}
                      </p>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        style={{
                          padding: '2px 8px', borderRadius: 6,
                          background: '#FFF0F0', border: 'none',
                          cursor: 'pointer', fontSize: 10, color: '#D63031',
                          fontWeight: 600,
                        }}
                      >
                        eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openModal}
        style={{
          position: 'fixed', bottom: 84, right: 20, zIndex: 30,
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C4623A, #A85130)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(196,98,58,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Plus size={26} color="white" strokeWidth={2.5} />
      </button>

      {/* Add expense modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.52)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            maxHeight: '92vh', overflowY: 'auto',
            padding: '24px 20px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>

            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 22,
            }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
                  Nuevo gasto
                </p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  Cuentas Claras
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}
              >
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Amount */}
              <div>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Monto *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%',
                    transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 14, pointerEvents: 'none',
                  }}>
                    $
                  </span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    style={{ ...fieldStyle, paddingLeft: 28 }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Categoría *
                </label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  style={{
                    ...fieldStyle,
                    appearance: 'none',
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    paddingRight: 36,
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.id}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Descripción
                </label>
                <input
                  name="description"
                  type="text"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="ej. Insulina, Visita al cardiólogo..."
                  style={fieldStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Pagó + Fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                    letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    Pagó *
                  </label>
                  <input
                    name="paid_by"
                    type="text"
                    required
                    value={form.paid_by}
                    onChange={handleChange}
                    placeholder="Tu nombre"
                    style={fieldStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                    letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    Fecha *
                  </label>
                  <input
                    name="date"
                    type="date"
                    required
                    value={form.date}
                    onChange={handleChange}
                    style={fieldStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Receipt photo */}
              <div>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
                  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Foto del recibo (opcional)
                </label>
                {photoPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={photoPreview}
                      alt="Recibo"
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '2px solid #EDE5D8' }}
                    />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#D63031', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <XIcon size={10} color="white" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 12px', borderRadius: 12,
                        border: '1.5px dashed #D4C4B8', background: '#FDF8F4',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>📷</span>
                      <span style={{ fontSize: 12, color: '#C4623A', fontWeight: 600 }}>Tomar foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 12px', borderRadius: 12,
                        border: '1.5px dashed #D4C4B8', background: '#FDF8F4',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>🖼️</span>
                      <span style={{ fontSize: 12, color: '#C4623A', fontWeight: 600 }}>Elegir de galería</span>
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </div>

              {saveError && (
                <div style={{
                  padding: '10px 14px', background: '#FFF0F0',
                  border: '1px solid #FFBABA', borderRadius: 10,
                  fontSize: 13, color: '#D63031',
                }}>
                  ⚠ {saveError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSave || !canEdit}
                onClick={!canEdit ? (e) => { e.preventDefault(); navigate('/pricing') } : undefined}
                style={{
                  marginTop: 4, width: '100%', padding: '14px',
                  background: (canSave && canEdit)
                    ? 'linear-gradient(135deg, #C4623A, #A85130)'
                    : '#D4C4B8',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  borderRadius: 14, border: 'none',
                  cursor: (canSave && canEdit) ? 'pointer' : 'not-allowed',
                  boxShadow: canSave ? '0 6px 20px rgba(196,98,58,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar gasto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
