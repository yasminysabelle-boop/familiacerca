import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  Plus, XIcon, Phone, Mail, MapPin, Star, Pencil, Trash,
  BookOpen, User, AlertTriangle,
} from '../components/Icons'

// ── Constants ─────────────────────────────────────────────────────
const BLANK_DOC = { name: '', specialty: '', phone: '', email: '', clinic: '', notes: '' }
const BLANK_CON = { name: '', relationship: '', phone: '', email: '', address: '', is_emergency_contact: false, notes: '' }

const FIELD = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #EDE5D8', borderRadius: 12,
  fontSize: 14, outline: 'none', background: '#FDFAF7',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const onFocus = e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

// ── Small helpers ─────────────────────────────────────────────────
function InfoRow({ Icon: Ic, value, href }) {
  if (!value) return null
  const inner = (
    <div className="flex items-start gap-2 mt-2">
      <Ic size={14} color="#9CA3AF" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
      <span className="text-xs text-gray-600 break-all leading-relaxed">{value}</span>
    </div>
  )
  return href ? <a href={href} className="block">{inner}</a> : inner
}

function Label({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: '#6B7280',
      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
    }}>
      {children}
    </p>
  )
}

function FormInput({ label, value, onChange, type = 'text', placeholder, rows }) {
  return (
    <div>
      <Label>{label}</Label>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...FIELD, resize: 'none' }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={FIELD}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}
    </div>
  )
}

function CardActions({ onEdit, onDelete, isConfirm, onConfirm, onCancel }) {
  if (isConfirm) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-500">¿Eliminar?</span>
        <button
          onClick={onCancel}
          className="px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: '#F3F4F6', color: '#6B7280', border: 'none' }}
        >
          No
        </button>
        <button
          onClick={onConfirm}
          className="px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: '#FFF0F0', color: '#D63031', border: '1px solid #FFBABA' }}
        >
          Sí
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={onEdit}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: '#F3F4F6', border: 'none' }}
      >
        <Pencil size={13} color="#6B7280" strokeWidth={1.75} />
      </button>
      <button
        onClick={onDelete}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: '#FFF0F0', border: 'none' }}
      >
        <Trash size={13} color="#D63031" strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ── Doctor card ────────────────────────────────────────────────────
function DoctorCard({ doctor, onEdit, isConfirm, onConfirm, onCancel, onDeleteRequest }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8', borderTop: '3px solid #4A7C59' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm truncate" style={{ fontFamily: 'Georgia, serif' }}>
            {doctor.name}
          </p>
          {doctor.specialty && (
            <p className="text-xs font-medium mt-0.5" style={{ color: '#4A7C59' }}>{doctor.specialty}</p>
          )}
        </div>
        <CardActions
          onEdit={onEdit}
          onDelete={onDeleteRequest}
          isConfirm={isConfirm}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>
      <div className="mt-1">
        <InfoRow Icon={Phone} value={doctor.phone} href={doctor.phone ? `tel:${doctor.phone}` : undefined} />
        <InfoRow Icon={Mail}  value={doctor.email} href={doctor.email ? `mailto:${doctor.email}` : undefined} />
        <InfoRow Icon={BookOpen} value={doctor.clinic} />
        {doctor.notes && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed pl-4 border-l-2 border-gray-100">
            {doctor.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Contact card ───────────────────────────────────────────────────
function ContactCard({ contact, onEdit, onToggleEmergency, isConfirm, onConfirm, onCancel, onDeleteRequest }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3"
      style={{
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: contact.is_emergency_contact ? '1.5px solid #FFBABA' : '1px solid #EDE5D8',
        borderTop: `3px solid ${contact.is_emergency_contact ? '#D63031' : '#C4623A'}`,
      }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {contact.is_emergency_contact && (
            <div className="flex items-center gap-1 mb-1">
              <Star size={11} color="#D63031" strokeWidth={2} filled />
              <span className="text-[10px] font-bold tracking-wider" style={{ color: '#D63031' }}>
                EMERGENCIA
              </span>
            </div>
          )}
          <p className="font-bold text-gray-900 text-sm truncate" style={{ fontFamily: 'Georgia, serif' }}>
            {contact.name}
          </p>
          {contact.relationship && (
            <p className="text-xs font-medium mt-0.5 text-gray-500">{contact.relationship}</p>
          )}
        </div>
        <CardActions
          onEdit={onEdit}
          onDelete={onDeleteRequest}
          isConfirm={isConfirm}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>
      <div className="mt-1">
        <InfoRow Icon={Phone}  value={contact.phone}   href={contact.phone  ? `tel:${contact.phone}`      : undefined} />
        <InfoRow Icon={Mail}   value={contact.email}   href={contact.email  ? `mailto:${contact.email}`   : undefined} />
        <InfoRow Icon={MapPin} value={contact.address} />
        {contact.notes && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed pl-4 border-l-2 border-gray-100">
            {contact.notes}
          </p>
        )}
      </div>
      <button
        onClick={() => onToggleEmergency(contact)}
        className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
        style={{
          background: contact.is_emergency_contact ? '#FFF0F0' : '#F9F5F1',
          border: contact.is_emergency_contact ? '1px solid #FFBABA' : '1px solid #EDE5D8',
          color: contact.is_emergency_contact ? '#D63031' : '#9CA3AF',
        }}
      >
        <Star size={11} color={contact.is_emergency_contact ? '#D63031' : '#9CA3AF'} strokeWidth={1.75} filled={contact.is_emergency_contact} />
        {contact.is_emergency_contact ? 'Quitar emergencia' : 'Marcar como emergencia'}
      </button>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ icon: Ic, title, subtitle }) {
  return (
    <div className="flex flex-col items-center py-10 gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#F5EEE6' }}>
        <Ic size={26} color="#C4623A" strokeWidth={1.3} />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 text-center max-w-[220px] leading-relaxed">{subtitle}</p>
    </div>
  )
}

// ── Add button ─────────────────────────────────────────────────────
function AddBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm mt-2 active:scale-[0.98] transition-transform"
      style={{ border: '1.5px dashed #C4623A', background: '#FFF8F4', color: '#C4623A' }}
    >
      <Plus size={16} color="#C4623A" strokeWidth={2} />
      {label}
    </button>
  )
}

// ── Bottom-sheet modal wrapper ─────────────────────────────────────
function SheetModal({ title, subtitle, onClose, children, onSave, saveLabel, saving }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'white', borderRadius: '24px 24px 0 0',
        padding: '28px 24px 40px',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
        maxHeight: '90svh', overflowY: 'auto',
      }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
              {title}
            </p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}
          >
            <XIcon size={16} color="#6B7280" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {children}
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="w-full mt-6 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
          style={{
            background: saving ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 6px 20px rgba(196,98,58,0.3)',
          }}
        >
          {saving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function Directory() {
  const { user } = useAuth()

  const [tab, setTab] = useState('medicos')
  const [doctors, setDoctors]   = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type, id }

  // Doctor form
  const [docModal, setDocModal]   = useState(false)
  const [editDoc,  setEditDoc]    = useState(null)
  const [docForm,  setDocForm]    = useState(BLANK_DOC)
  const [savingDoc, setSavingDoc] = useState(false)

  // Contact form
  const [conModal, setConModal]   = useState(false)
  const [editCon,  setEditCon]    = useState(null)
  const [conForm,  setConForm]    = useState(BLANK_CON)
  const [savingCon, setSavingCon] = useState(false)

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    const [{ data: docs }, { data: cons }] = await Promise.all([
      supabase.from('doctors').select('*').eq('user_id', user.id).order('name'),
      supabase.from('contacts').select('*').eq('user_id', user.id).order('name'),
    ])
    setDoctors(docs ?? [])
    setContacts(cons ?? [])
    setLoading(false)
  }

  // ── Doctor CRUD ────────────────────────────────────────────────
  function openDoc(d = null) {
    setEditDoc(d)
    setDocForm(d
      ? { name: d.name, specialty: d.specialty ?? '', phone: d.phone ?? '', email: d.email ?? '', clinic: d.clinic ?? '', notes: d.notes ?? '' }
      : BLANK_DOC
    )
    setDocModal(true)
  }

  async function saveDoc() {
    if (!docForm.name.trim()) return
    setSavingDoc(true)
    if (editDoc) {
      await supabase.from('doctors')
        .update({ ...docForm, updated_at: new Date().toISOString() })
        .eq('id', editDoc.id)
    } else {
      await supabase.from('doctors').insert({ ...docForm, user_id: user.id })
    }
    setSavingDoc(false)
    setDocModal(false)
    fetchAll()
  }

  // ── Contact CRUD ───────────────────────────────────────────────
  function openCon(c = null) {
    setEditCon(c)
    setConForm(c
      ? { name: c.name, relationship: c.relationship ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', is_emergency_contact: c.is_emergency_contact, notes: c.notes ?? '' }
      : BLANK_CON
    )
    setConModal(true)
  }

  async function saveCon() {
    if (!conForm.name.trim()) return
    setSavingCon(true)
    // Ensure only one emergency contact exists
    if (conForm.is_emergency_contact) {
      await supabase.from('contacts')
        .update({ is_emergency_contact: false })
        .eq('user_id', user.id)
    }
    if (editCon) {
      await supabase.from('contacts')
        .update({ ...conForm, updated_at: new Date().toISOString() })
        .eq('id', editCon.id)
    } else {
      await supabase.from('contacts').insert({ ...conForm, user_id: user.id })
    }
    setSavingCon(false)
    setConModal(false)
    fetchAll()
  }

  async function deleteItem(type, id) {
    await supabase.from(type === 'doctor' ? 'doctors' : 'contacts').delete().eq('id', id)
    setConfirmDelete(null)
    fetchAll()
  }

  async function toggleEmergency(contact) {
    if (contact.is_emergency_contact) {
      await supabase.from('contacts').update({ is_emergency_contact: false }).eq('id', contact.id)
    } else {
      await supabase.from('contacts').update({ is_emergency_contact: false }).eq('user_id', user.id)
      await supabase.from('contacts').update({ is_emergency_contact: true }).eq('id', contact.id)
    }
    fetchAll()
  }

  const emergency = contacts.find(c => c.is_emergency_contact)

  // ── Tab bar ────────────────────────────────────────────────────
  const TABS = [
    { id: 'medicos',    label: 'Médicos'    },
    { id: 'familiares', label: 'Familiares' },
    { id: 'emergencia', label: 'Emergencia', accent: '#D63031' },
  ]

  return (
    <Layout>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 px-5 pt-4 pb-3"
        style={{ background: '#FFF8F0', borderBottom: '1px solid #EDE5D8' }}>
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#F3F4F6' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? (t.accent ?? '#1A1A1A') : '#9CA3AF',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 pb-10">

        {/* ── Médicos tab ────────────────────────────────────────── */}
        {tab === 'medicos' && (
          <>
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-8">Cargando...</p>
            ) : doctors.length === 0 ? (
              <EmptyState icon={BookOpen} title="Sin médicos registrados" subtitle="Agrega los médicos tratantes para tenerlos siempre a la mano" />
            ) : (
              doctors.map(d => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  onEdit={() => openDoc(d)}
                  isConfirm={confirmDelete?.id === d.id}
                  onDeleteRequest={() => setConfirmDelete({ type: 'doctor', id: d.id })}
                  onConfirm={() => deleteItem('doctor', d.id)}
                  onCancel={() => setConfirmDelete(null)}
                />
              ))
            )}
            <AddBtn onClick={() => openDoc()} label="Agregar médico" />
          </>
        )}

        {/* ── Familiares tab ─────────────────────────────────────── */}
        {tab === 'familiares' && (
          <>
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-8">Cargando...</p>
            ) : contacts.length === 0 ? (
              <EmptyState icon={User} title="Sin contactos registrados" subtitle="Agrega familiares y designa un contacto de emergencia" />
            ) : (
              contacts.map(c => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  onEdit={() => openCon(c)}
                  onToggleEmergency={toggleEmergency}
                  isConfirm={confirmDelete?.id === c.id}
                  onDeleteRequest={() => setConfirmDelete({ type: 'contact', id: c.id })}
                  onConfirm={() => deleteItem('contact', c.id)}
                  onCancel={() => setConfirmDelete(null)}
                />
              ))
            )}
            <AddBtn onClick={() => openCon()} label="Agregar contacto" />
          </>
        )}

        {/* ── Emergencia tab ─────────────────────────────────────── */}
        {tab === 'emergencia' && (
          emergency ? (
            <div>
              {/* Hero card */}
              <div className="rounded-3xl p-6 mb-5 text-center"
                style={{
                  background: 'linear-gradient(145deg, #D63031 0%, #A52020 100%)',
                  boxShadow: '0 8px 32px rgba(214,48,49,0.25)',
                }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
                  <User size={32} color="white" strokeWidth={1.3} />
                </div>
                <p className="text-white font-bold text-xl" style={{ fontFamily: 'Georgia, serif' }}>
                  {emergency.name}
                </p>
                {emergency.relationship && (
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {emergency.relationship}
                  </p>
                )}
                {emergency.phone && (
                  <p className="mt-3 font-mono text-base" style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>
                    {emergency.phone}
                  </p>
                )}
              </div>

              {/* Call button */}
              {emergency.phone && (
                <a
                  href={`tel:${emergency.phone}`}
                  className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-white text-base mb-3 active:scale-[0.97] transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                    boxShadow: '0 6px 24px rgba(34,197,94,0.35)',
                    textDecoration: 'none',
                  }}
                >
                  <Phone size={20} color="white" strokeWidth={2} />
                  Llamar ahora
                </a>
              )}

              {/* Email button */}
              {emergency.email && (
                <a
                  href={`mailto:${emergency.email}`}
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-semibold text-sm mb-3 active:scale-[0.97] transition-transform"
                  style={{
                    border: '1.5px solid #EDE5D8', background: 'white',
                    color: '#374151', textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <Mail size={16} color="#6B7280" strokeWidth={1.75} />
                  Enviar correo
                </a>
              )}

              {/* Address */}
              {emergency.address && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl mt-1"
                  style={{ background: '#F9F5F1', border: '1px solid #EDE5D8' }}>
                  <MapPin size={16} color="#9CA3AF" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p className="text-sm text-gray-600 leading-relaxed">{emergency.address}</p>
                </div>
              )}

              <button
                onClick={() => setTab('familiares')}
                className="w-full mt-5 py-3 rounded-2xl text-xs font-semibold"
                style={{ background: '#F9F5F1', border: '1px solid #EDE5D8', color: '#9CA3AF' }}
              >
                Editar contacto de emergencia
              </button>
            </div>
          ) : (
            <div>
              <EmptyState
                icon={AlertTriangle}
                title="Sin contacto de emergencia"
                subtitle="Ve a Familiares y marca uno como contacto de emergencia"
              />
              <button
                onClick={() => setTab('familiares')}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white mt-2 active:scale-[0.97] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #D63031, #A52020)',
                  border: 'none', boxShadow: '0 4px 16px rgba(214,48,49,0.3)',
                }}
              >
                Ir a Familiares →
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Doctor modal ─────────────────────────────────────────── */}
      {docModal && (
        <SheetModal
          title={editDoc ? 'Editar médico' : 'Nuevo médico'}
          subtitle="Los datos se guardan en tu directorio"
          onClose={() => setDocModal(false)}
          onSave={saveDoc}
          saveLabel={editDoc ? 'Guardar cambios' : 'Agregar médico'}
          saving={savingDoc}
        >
          <FormInput label="Nombre *" value={docForm.name}      onChange={v => setDocForm(f => ({ ...f, name: v }))}      placeholder="Dr. Ana García" />
          <FormInput label="Especialidad" value={docForm.specialty} onChange={v => setDocForm(f => ({ ...f, specialty: v }))} placeholder="Cardiología" />
          <FormInput label="Teléfono"     value={docForm.phone}     onChange={v => setDocForm(f => ({ ...f, phone: v }))}     placeholder="555-123-4567" type="tel" />
          <FormInput label="Correo"       value={docForm.email}     onChange={v => setDocForm(f => ({ ...f, email: v }))}     placeholder="medico@hospital.com" type="email" />
          <FormInput label="Clínica / Hospital" value={docForm.clinic} onChange={v => setDocForm(f => ({ ...f, clinic: v }))} placeholder="Hospital General" />
          <FormInput label="Notas"        value={docForm.notes}     onChange={v => setDocForm(f => ({ ...f, notes: v }))}     placeholder="Próxima cita: …" rows={3} />
        </SheetModal>
      )}

      {/* ── Contact modal ─────────────────────────────────────────── */}
      {conModal && (
        <SheetModal
          title={editCon ? 'Editar contacto' : 'Nuevo contacto'}
          subtitle="Agrega familiares y personas de confianza"
          onClose={() => setConModal(false)}
          onSave={saveCon}
          saveLabel={editCon ? 'Guardar cambios' : 'Agregar contacto'}
          saving={savingCon}
        >
          <FormInput label="Nombre *"     value={conForm.name}         onChange={v => setConForm(f => ({ ...f, name: v }))}         placeholder="María López" />
          <FormInput label="Parentesco"   value={conForm.relationship} onChange={v => setConForm(f => ({ ...f, relationship: v }))} placeholder="Hija, Hermano, Vecino…" />
          <FormInput label="Teléfono"     value={conForm.phone}        onChange={v => setConForm(f => ({ ...f, phone: v }))}        placeholder="555-678-9012" type="tel" />
          <FormInput label="Correo"       value={conForm.email}        onChange={v => setConForm(f => ({ ...f, email: v }))}        placeholder="familiar@correo.com" type="email" />
          <FormInput label="Dirección"    value={conForm.address}      onChange={v => setConForm(f => ({ ...f, address: v }))}      placeholder="Calle Robles 45, Col. Centro" />
          <FormInput label="Notas"        value={conForm.notes}        onChange={v => setConForm(f => ({ ...f, notes: v }))}        placeholder="Disponible fines de semana…" rows={2} />

          {/* Emergency toggle */}
          <button
            type="button"
            onClick={() => setConForm(f => ({ ...f, is_emergency_contact: !f.is_emergency_contact }))}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{
              background: conForm.is_emergency_contact ? '#FFF0F0' : '#F9F5F1',
              border: conForm.is_emergency_contact ? '1.5px solid #FFBABA' : '1.5px solid #EDE5D8',
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: conForm.is_emergency_contact ? '#D63031' : 'white', border: conForm.is_emergency_contact ? 'none' : '1.5px solid #EDE5D8' }}>
              {conForm.is_emergency_contact && <Star size={10} color="white" strokeWidth={2} filled />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: conForm.is_emergency_contact ? '#D63031' : '#374151' }}>
                Contacto de emergencia
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Solo puede haber uno — reemplaza al anterior
              </p>
            </div>
          </button>
        </SheetModal>
      )}
    </Layout>
  )
}
