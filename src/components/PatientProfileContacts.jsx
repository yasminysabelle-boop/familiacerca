import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MEDICAL_SPECIALTIES, INSTITUTION_TYPES, RELATIONSHIP_TYPES } from '../utils/medicalSpecialties'

// ── Style helpers ─────────────────────────────────────────────────────────────
const F = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #EDE5D8',
  borderRadius: 10, fontSize: 14, outline: 'none', background: '#FDFAF7',
  boxSizing: 'border-box', color: '#1F2937', fontFamily: 'system-ui,sans-serif',
}
const fo = e => { e.target.style.borderColor = '#0891B2'; e.target.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.1)' }
const fb = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }
const L  = { fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }

// ── Primitive field components ────────────────────────────────────────────────
function Inp({ label, value, onChange, type = 'text', placeholder, mb = 10 }) {
  return (
    <div style={{ marginBottom: mb }}>
      {label && <label style={L}>{label}</label>}
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={F} onFocus={fo} onBlur={fb} />
    </div>
  )
}

function Sel({ label, value, onChange, options, placeholder = 'Seleccionar...', mb = 10 }) {
  return (
    <div style={{ marginBottom: mb }}>
      {label && <label style={L}>{label}</label>}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ ...F, cursor: 'pointer' }} onFocus={fo} onBlur={fb}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Grid2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function CatLabel({ icon, title, color }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '18px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{title}
    </p>
  )
}

function AddBtn({ label, color, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', padding: '10px', borderRadius: 12, marginBottom: 4,
      border: `1.5px dashed ${color}66`, background: 'transparent',
      color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    }}>+ {label}</button>
  )
}

function CallBtn({ phone, big = false }) {
  if (!phone) return null
  return (
    <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      padding: big ? '10px 18px' : '6px 11px', borderRadius: 10, textDecoration: 'none',
      fontWeight: 700, fontSize: big ? 14 : 12,
      background: big ? 'linear-gradient(135deg, #D63031, #B91C1C)' : '#F0FDF4',
      color: big ? 'white' : '#16A34A',
      boxShadow: big ? '0 4px 14px rgba(214,48,49,0.25)' : 'none',
    }}>
      📞 {big ? 'LLAMAR' : 'Llamar'}
    </a>
  )
}

function EditDeleteBtns({ onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button type="button" onClick={onEdit}   style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #EDE5D8', background: 'white', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✏️</button>
      <button type="button" onClick={onDelete} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #FFCDD2', background: '#FFF8F8', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>🗑️</button>
    </div>
  )
}

function SaveCancelBtns({ onSave, onCancel, saving, disabled, color = '#0891B2' }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #EDE5D8', background: 'white', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>
        Cancelar
      </button>
      <button type="button" onClick={onSave} disabled={saving || disabled} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: disabled || saving ? '#C0CCC5' : color, color: 'white', fontWeight: 700, fontSize: 13, cursor: disabled || saving ? 'not-allowed' : 'pointer' }}>
        {saving ? '...' : 'Guardar'}
      </button>
    </div>
  )
}

// ── Doctor card + form ────────────────────────────────────────────────────────
function DoctorCard({ doc, canEdit, onEdit, onDelete }) {
  const phone = doc.phone || doc.cellphone
  return (
    <div style={{ background: '#F0F9FF', borderRadius: 14, padding: '12px 14px', marginBottom: 8, border: '1px solid #BAE6FD' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{doc.name}</p>
          {doc.specialty && <p style={{ fontSize: 12, color: '#0891B2', margin: '0 0 2px', fontWeight: 600 }}>{doc.specialty}</p>}
          {doc.clinic && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>🏥 {doc.clinic}</p>}
          {doc.address && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>📍 {doc.address}</p>}
          {doc.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>☎ {doc.phone}</p>}
          {doc.cellphone && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>📱 {doc.cellphone}</p>}
          {doc.email && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>✉ {doc.email}</p>}
          {doc.notes && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>{doc.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={phone} />
          {canEdit && <EditDeleteBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function DoctorForm({ data, onChange, onSave, onCancel, saving }) {
  return (
    <div style={{ background: '#F0F9FF', borderRadius: 14, padding: 14, marginBottom: 8, border: '1.5px solid #0891B2' }}>
      <Inp label="Nombre completo" value={data.name} onChange={v => onChange('name', v)} placeholder="Dr. / Dra." />
      <Sel label="Especialidad" value={data.specialty} onChange={v => onChange('specialty', v)} options={MEDICAL_SPECIALTIES} placeholder="Seleccionar especialidad..." />
      <Grid2>
        <Inp label="Teléfono oficina" value={data.phone}      onChange={v => onChange('phone', v)}      type="tel" placeholder="55 1234 5678" />
        <Inp label="Celular"          value={data.cellphone}  onChange={v => onChange('cellphone', v)}  type="tel" placeholder="55 9876 5432" />
      </Grid2>
      <Inp label="Email" value={data.email} onChange={v => onChange('email', v)} type="email" placeholder="doctor@clinica.com" />
      <Inp label="Dirección / Clínica" value={data.address ?? data.clinic} onChange={v => onChange('address', v)} placeholder="Av. Principal 123, Col. Centro" />
      <Inp label="Notas" value={data.notes} onChange={v => onChange('notes', v)} placeholder="Horario, referencias..." mb={0} />
      <SaveCancelBtns onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} />
    </div>
  )
}

// ── Institution card + form ───────────────────────────────────────────────────
function InstitutionCard({ inst, canEdit, onEdit, onDelete }) {
  return (
    <div style={{ background: '#FAF5FF', borderRadius: 14, padding: '12px 14px', marginBottom: 8, border: '1px solid #E9D5FF' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{inst.name}</p>
            {inst.type && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: 6 }}>{inst.type}</span>}
          </div>
          {inst.address && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>📍 {inst.address}</p>}
          {inst.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>☎ {inst.phone}</p>}
          {inst.email && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>✉ {inst.email}</p>}
          {inst.hours && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>🕐 {inst.hours}</p>}
          {inst.notes && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>{inst.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={inst.phone} />
          {canEdit && <EditDeleteBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function InstitutionForm({ data, onChange, onSave, onCancel, saving }) {
  return (
    <div style={{ background: '#FAF5FF', borderRadius: 14, padding: 14, marginBottom: 8, border: '1.5px solid #7C3AED' }}>
      <Inp label="Nombre del establecimiento" value={data.name} onChange={v => onChange('name', v)} placeholder="Farmacia del Ahorro" />
      <Sel label="Tipo" value={data.type} onChange={v => onChange('type', v)} options={INSTITUTION_TYPES} placeholder="Seleccionar tipo..." />
      <Grid2>
        <Inp label="Teléfono" value={data.phone} onChange={v => onChange('phone', v)} type="tel" placeholder="55 1234 5678" />
        <Inp label="Email"    value={data.email} onChange={v => onChange('email', v)} type="email" placeholder="info@lugar.com" />
      </Grid2>
      <Inp label="Dirección"          value={data.address} onChange={v => onChange('address', v)} placeholder="Calle Principal 123" />
      <Inp label="Horario de atención" value={data.hours}   onChange={v => onChange('hours', v)}   placeholder="Lun–Vie 8am–8pm" />
      <Inp label="Notas" value={data.notes} onChange={v => onChange('notes', v)} placeholder="Referencia, detalles..." mb={0} />
      <SaveCancelBtns onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} accentColor="#7C3AED" color="#7C3AED" />
    </div>
  )
}

// ── Contact card + form (emergency + friends) ─────────────────────────────────
function ContactCard({ contact, canEdit, isEmergency, onEdit, onDelete }) {
  const phone = contact.phone
  const bg     = isEmergency ? '#FFF5F5' : '#FAF5FF'
  const border = isEmergency ? '1.5px solid #FECACA' : '1px solid #E9D5FF'
  const relColor = isEmergency ? '#D63031' : '#7C3AED'
  return (
    <div style={{ borderRadius: 14, padding: '12px 14px', marginBottom: 8, background: bg, border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{contact.name}</p>
          {contact.relationship && <p style={{ fontSize: 12, color: relColor, margin: '0 0 2px', fontWeight: 600 }}>{contact.relationship}</p>}
          {phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>📱 {phone}</p>}
          {contact.email && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>✉ {contact.email}</p>}
          {contact.address && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 1px' }}>📍 {contact.address}</p>}
          {contact.notes && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>{contact.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={phone} big={isEmergency} />
          {canEdit && <EditDeleteBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function ContactForm({ data, onChange, onSave, onCancel, saving, isEmergency }) {
  const color  = isEmergency ? '#D63031' : '#7C3AED'
  const bg     = isEmergency ? '#FFF5F5' : '#FAF5FF'
  const border = isEmergency ? '#FECACA' : '#C4B5FD'
  return (
    <div style={{ background: bg, borderRadius: 14, padding: 14, marginBottom: 8, border: `1.5px solid ${border}` }}>
      <Inp label="Nombre completo" value={data.name} onChange={v => onChange('name', v)} placeholder="Nombre completo" />
      <Sel label="Parentesco / Relación" value={data.relationship} onChange={v => onChange('relationship', v)} options={RELATIONSHIP_TYPES} placeholder="Seleccionar parentesco..." />
      <Grid2>
        <Inp label="Celular"          value={data.phone}   onChange={v => onChange('phone', v)}   type="tel" placeholder="55 1234 5678" />
        <Inp label="Email"            value={data.email}   onChange={v => onChange('email', v)}   type="email" placeholder="correo@mail.com" />
      </Grid2>
      <Inp label="Dirección" value={data.address} onChange={v => onChange('address', v)} placeholder="Calle, ciudad (opcional)" />
      <Inp label="Notas"     value={data.notes}   onChange={v => onChange('notes', v)}   placeholder="Disponible tardes, etc." mb={0} />
      <SaveCancelBtns onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} color={color} />
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize: 36, marginBottom: 10 }}>🗑️</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px' }}>¿Eliminar contacto?</p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px' }}>{name}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(214,48,49,0.3)' }}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PatientProfileContacts({ ownerId, canEdit, initialForm, onBadgeChange }) {
  const [doctors,   setDoctors]   = useState([])
  const [insts,     setInsts]     = useState([])
  const [emergency, setEmergency] = useState([])
  const [friends,   setFriends]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState({})
  const [addingTo,  setAddingTo]  = useState(null)
  const [addData,   setAddData]   = useState({})
  const [saving,    setSaving]    = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => { if (ownerId) fetchAll() }, [ownerId])

  useEffect(() => {
    onBadgeChange?.(doctors.length + insts.length + emergency.length + friends.length)
  }, [doctors, insts, emergency, friends])

  async function fetchAll() {
    setLoading(true)
    const [{ data: docs }, { data: allInsts }, { data: ctcs }] = await Promise.all([
      supabase.from('directory_doctors').select('*').eq('owner_id', ownerId).order('created_at'),
      supabase.from('directory_institutions').select('*').eq('owner_id', ownerId).order('name'),
      supabase.from('directory_contacts').select('*').eq('owner_id', ownerId).order('created_at'),
    ])
    const docsArr = docs ?? []
    const ctcsArr = ctcs ?? []
    setDoctors(docsArr)
    setInsts(allInsts ?? [])
    setEmergency(ctcsArr.filter(c => c.is_emergency_contact))
    setFriends(ctcsArr.filter(c => !c.is_emergency_contact))
    if (initialForm) await migrate(docsArr, ctcsArr)
    setLoading(false)
  }

  async function migrate(existingDocs, existingCtcs) {
    const docInserts = []
    const ctcInserts = []
    if (!existingDocs.some(d => d.is_primary) && initialForm?.medico_tratante) {
      docInserts.push({ owner_id: ownerId, is_primary: true, name: initialForm.medico_tratante, specialty: initialForm.especialidad_medico || null, phone: initialForm.telefono_medico || null })
    }
    if (existingDocs.filter(d => !d.is_primary).length === 0) {
      for (const esp of (initialForm?.especialistas ?? [])) {
        if (esp.nombre) docInserts.push({ owner_id: ownerId, is_primary: false, name: esp.nombre, specialty: esp.especialidad || null, phone: esp.telefono || null })
      }
    }
    if (!existingCtcs.some(c => c.is_emergency_contact) && initialForm?.contacto_emergencia_nombre) {
      ctcInserts.push({ owner_id: ownerId, is_emergency_contact: true, name: initialForm.contacto_emergencia_nombre, phone: initialForm.contacto_emergencia_telefono || null })
    }
    if (docInserts.length === 0 && ctcInserts.length === 0) return
    const results = await Promise.all([
      ...docInserts.map(d => supabase.from('directory_doctors').insert(d).select().single()),
      ...ctcInserts.map(c => supabase.from('directory_contacts').insert(c).select().single()),
    ])
    const newDocs = results.slice(0, docInserts.length).map(r => r.data).filter(Boolean)
    const newCtcs = results.slice(docInserts.length).map(r => r.data).filter(Boolean)
    setDoctors(prev => [...prev, ...newDocs])
    const allCtcs = [...existingCtcs, ...newCtcs]
    setEmergency(allCtcs.filter(c => c.is_emergency_contact))
    setFriends(allCtcs.filter(c => !c.is_emergency_contact))
  }

  // ── Doctor CRUD ───────────────────────────────────────────────────────────────
  async function addDoctor(isPrimary) {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_doctors')
      .insert({ owner_id: ownerId, is_primary: isPrimary, name: addData.name.trim(), specialty: addData.specialty || null, phone: addData.phone || null, cellphone: addData.cellphone || null, email: addData.email || null, address: addData.address || null, notes: addData.notes || null })
      .select().single()
    if (row) setDoctors(prev => [...prev, row])
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateDoctor(id) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_doctors')
      .update({ name: editData.name.trim(), specialty: editData.specialty || null, phone: editData.phone || null, cellphone: editData.cellphone || null, email: editData.email || null, address: editData.address || null, notes: editData.notes || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', ownerId).select().single()
    if (row) setDoctors(prev => prev.map(d => d.id === id ? row : d))
    setEditId(null); setSaving(false)
  }

  async function deleteDoctor(id) {
    await supabase.from('directory_doctors').delete().eq('id', id).eq('owner_id', ownerId)
    setDoctors(prev => prev.filter(d => d.id !== id))
    setConfirmDel(null)
  }

  // ── Institution CRUD ──────────────────────────────────────────────────────────
  async function addInst() {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_institutions')
      .insert({ owner_id: ownerId, name: addData.name.trim(), type: addData.type || 'Otro', phone: addData.phone || null, email: addData.email || null, address: addData.address || null, hours: addData.hours || null, notes: addData.notes || null })
      .select().single()
    if (row) setInsts(prev => [...prev, row])
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateInst(id) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_institutions')
      .update({ name: editData.name.trim(), type: editData.type || 'Otro', phone: editData.phone || null, email: editData.email || null, address: editData.address || null, hours: editData.hours || null, notes: editData.notes || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', ownerId).select().single()
    if (row) setInsts(prev => prev.map(f => f.id === id ? row : f))
    setEditId(null); setSaving(false)
  }

  async function deleteInst(id) {
    await supabase.from('directory_institutions').delete().eq('id', id).eq('owner_id', ownerId)
    setInsts(prev => prev.filter(f => f.id !== id))
    setConfirmDel(null)
  }

  // ── Contact CRUD ──────────────────────────────────────────────────────────────
  async function addContact(isEmergency) {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_contacts')
      .insert({ owner_id: ownerId, is_emergency_contact: isEmergency, name: addData.name.trim(), relationship: addData.relationship || null, phone: addData.phone || null, email: addData.email || null, address: addData.address || null, notes: addData.notes || null })
      .select().single()
    if (row) { if (isEmergency) setEmergency(prev => [...prev, row]); else setFriends(prev => [...prev, row]) }
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateContact(id, isEmergency) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_contacts')
      .update({ name: editData.name.trim(), relationship: editData.relationship || null, phone: editData.phone || null, email: editData.email || null, address: editData.address || null, notes: editData.notes || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', ownerId).select().single()
    if (row) { if (isEmergency) setEmergency(prev => prev.map(c => c.id === id ? row : c)); else setFriends(prev => prev.map(c => c.id === id ? row : c)) }
    setEditId(null); setSaving(false)
  }

  async function deleteContact(id, isEmergency) {
    await supabase.from('directory_contacts').delete().eq('id', id).eq('owner_id', ownerId)
    if (isEmergency) setEmergency(prev => prev.filter(c => c.id !== id))
    else setFriends(prev => prev.filter(c => c.id !== id))
    setConfirmDel(null)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function startEdit(item) { setEditId(item.id); setEditData({ ...item }); setAddingTo(null) }
  function startAdd(type)  { setAddingTo(type); setAddData({}); setEditId(null) }
  function cancelEdit()    { setEditId(null) }
  function cancelAdd()     { setAddingTo(null); setAddData({}) }
  const ed = (k, v) => setEditData(p => ({ ...p, [k]: v }))
  const ad = (k, v) => setAddData(p => ({ ...p, [k]: v }))

  if (loading) return <p style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando directorio...</p>

  const primaryDoctor = doctors.find(d => d.is_primary)
  const specialists   = doctors.filter(d => !d.is_primary)

  return (
    <div>
      {/* ── 👨‍⚕️ Médico de cabecera ──────────────────────────────────────────── */}
      <CatLabel icon="👨‍⚕️" title="Médico de cabecera" color="#0891B2" />

      {primaryDoctor && (
        editId === primaryDoctor.id
          ? <DoctorForm data={editData} onChange={ed} onSave={() => updateDoctor(primaryDoctor.id)} onCancel={cancelEdit} saving={saving} />
          : <DoctorCard doc={primaryDoctor} canEdit={canEdit} onEdit={() => startEdit(primaryDoctor)} onDelete={() => setConfirmDel({ type: 'doctor', id: primaryDoctor.id, name: primaryDoctor.name })} />
      )}
      {!primaryDoctor && (
        addingTo === 'doctor-primary'
          ? <DoctorForm data={addData} onChange={ad} onSave={() => addDoctor(true)} onCancel={cancelAdd} saving={saving} />
          : canEdit && <AddBtn label="Agregar médico de cabecera" color="#0891B2" onClick={() => startAdd('doctor-primary')} />
      )}

      {/* ── 🏥 Especialistas ──────────────────────────────────────────────────── */}
      <CatLabel icon="🏥" title="Especialistas" color="#0891B2" />
      {specialists.map(doc =>
        editId === doc.id
          ? <DoctorForm key={doc.id} data={editData} onChange={ed} onSave={() => updateDoctor(doc.id)} onCancel={cancelEdit} saving={saving} />
          : <DoctorCard key={doc.id} doc={doc} canEdit={canEdit} onEdit={() => startEdit(doc)} onDelete={() => setConfirmDel({ type: 'doctor', id: doc.id, name: doc.name })} />
      )}
      {addingTo === 'specialist'
        ? <DoctorForm data={addData} onChange={ad} onSave={() => addDoctor(false)} onCancel={cancelAdd} saving={saving} />
        : canEdit && <AddBtn label="Agregar especialista" color="#0891B2" onClick={() => startAdd('specialist')} />
      }

      {/* ── 🏢 Establecimientos ───────────────────────────────────────────────── */}
      <CatLabel icon="🏢" title="Establecimientos" color="#7C3AED" />
      {insts.map(inst =>
        editId === inst.id
          ? <InstitutionForm key={inst.id} data={editData} onChange={ed} onSave={() => updateInst(inst.id)} onCancel={cancelEdit} saving={saving} />
          : <InstitutionCard key={inst.id} inst={inst} canEdit={canEdit} onEdit={() => startEdit(inst)} onDelete={() => setConfirmDel({ type: 'inst', id: inst.id, name: inst.name })} />
      )}
      {addingTo === 'inst'
        ? <InstitutionForm data={addData} onChange={ad} onSave={addInst} onCancel={cancelAdd} saving={saving} />
        : canEdit && <AddBtn label="Agregar establecimiento" color="#7C3AED" onClick={() => startAdd('inst')} />
      }

      {/* ── 🚨 Emergencia ─────────────────────────────────────────────────────── */}
      <CatLabel icon="🚨" title="Emergencia" color="#D63031" />
      {emergency.map(c =>
        editId === c.id
          ? <ContactForm key={c.id} data={editData} onChange={ed} onSave={() => updateContact(c.id, true)} onCancel={cancelEdit} saving={saving} isEmergency />
          : <ContactCard key={c.id} contact={c} canEdit={canEdit} isEmergency onEdit={() => startEdit(c)} onDelete={() => setConfirmDel({ type: 'emergency', id: c.id, name: c.name })} />
      )}
      {addingTo === 'emergency'
        ? <ContactForm data={addData} onChange={ad} onSave={() => addContact(true)} onCancel={cancelAdd} saving={saving} isEmergency />
        : canEdit && <AddBtn label="Agregar contacto de emergencia" color="#D63031" onClick={() => startAdd('emergency')} />
      }

      {/* ── 👫 Amigos y familiares ────────────────────────────────────────────── */}
      <CatLabel icon="👫" title="Amigos y familiares cercanos" color="#7C3AED" />
      {friends.map(c =>
        editId === c.id
          ? <ContactForm key={c.id} data={editData} onChange={ed} onSave={() => updateContact(c.id, false)} onCancel={cancelEdit} saving={saving} />
          : <ContactCard key={c.id} contact={c} canEdit={canEdit} onEdit={() => startEdit(c)} onDelete={() => setConfirmDel({ type: 'friend', id: c.id, name: c.name })} />
      )}
      {addingTo === 'friend'
        ? <ContactForm data={addData} onChange={ad} onSave={() => addContact(false)} onCancel={cancelAdd} saving={saving} />
        : canEdit && <AddBtn label="Agregar amigo o familiar" color="#7C3AED" onClick={() => startAdd('friend')} />
      }

      {/* ── Confirmación de borrado ───────────────────────────────────────────── */}
      {confirmDel && (
        <DeleteModal
          name={confirmDel.name}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            if (confirmDel.type === 'doctor')    deleteDoctor(confirmDel.id)
            else if (confirmDel.type === 'inst') deleteInst(confirmDel.id)
            else if (confirmDel.type === 'emergency') deleteContact(confirmDel.id, true)
            else deleteContact(confirmDel.id, false)
          }}
        />
      )}
    </div>
  )
}
