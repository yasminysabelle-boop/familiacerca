import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Style helpers ─────────────────────────────────────────────────────────────
const F = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #EDE5D8',
  borderRadius: 10, fontSize: 14, outline: 'none', background: '#FDFAF7',
  boxSizing: 'border-box', color: '#1F2937', fontFamily: 'system-ui,sans-serif',
}
const fo = e => { e.target.style.borderColor = '#0891B2'; e.target.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.1)' }
const fb = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

// ── Small helpers ─────────────────────────────────────────────────────────────
function Inp({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>}
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={F} onFocus={fo} onBlur={fb} />
    </div>
  )
}

function CatLabel({ icon, title, color }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{title}
    </p>
  )
}

function AddBtn({ label, color, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', padding: '10px', borderRadius: 12, marginBottom: 4,
      border: `1.5px dashed ${color}55`, background: 'transparent',
      color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    }}>
      + {label}
    </button>
  )
}

function CallBtn({ phone, big = false }) {
  if (!phone) return null
  return (
    <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: big ? '9px 16px' : '6px 11px', borderRadius: 10,
      textDecoration: 'none', flexShrink: 0, fontWeight: 700,
      background: big ? 'linear-gradient(135deg, #D63031, #B91C1C)' : '#F0FDF4',
      color: big ? 'white' : '#16A34A',
      fontSize: big ? 13 : 12,
      boxShadow: big ? '0 4px 14px rgba(214,48,49,0.25)' : 'none',
    }}>
      📞 {big ? 'LLAMAR' : 'Llamar'}
    </a>
  )
}

function ActionBtns({ onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button type="button" onClick={onEdit} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #EDE5D8', background: 'white', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✏️</button>
      <button type="button" onClick={onDelete} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #FFCDD2', background: '#FFF8F8', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>🗑️</button>
    </div>
  )
}

function FormActions({ onSave, onCancel, saving, disabled, accentColor = '#0891B2' }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
      <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #EDE5D8', background: 'white', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>
        Cancelar
      </button>
      <button type="button" onClick={onSave} disabled={saving || disabled} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: disabled || saving ? '#C0CCC5' : accentColor, color: 'white', fontWeight: 700, fontSize: 13, cursor: disabled || saving ? 'not-allowed' : 'pointer' }}>
        {saving ? '...' : 'Guardar'}
      </button>
    </div>
  )
}

// ── Doctor card ───────────────────────────────────────────────────────────────
function DoctorCard({ doc, canEdit, onEdit, onDelete }) {
  return (
    <div style={{ background: '#F0F9FF', borderRadius: 14, padding: '12px 14px', marginBottom: 8, border: '1px solid #BAE6FD' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{doc.name}</p>
          {doc.specialty && <p style={{ fontSize: 12, color: '#0891B2', margin: '0 0 2px', fontWeight: 600 }}>{doc.specialty}</p>}
          {doc.clinic && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 2px' }}>🏥 {doc.clinic}</p>}
          {doc.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>📱 {doc.phone}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={doc.phone} />
          {canEdit && <ActionBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function DoctorForm({ data, onChange, onSave, onCancel, saving, isNew }) {
  return (
    <div style={{ background: '#F0F9FF', borderRadius: 14, padding: 14, marginBottom: 8, border: '1.5px solid #0891B2' }}>
      <Inp label="Nombre" value={data.name} onChange={v => onChange('name', v)} placeholder="Dr. / Dra." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Inp label="Especialidad" value={data.specialty} onChange={v => onChange('specialty', v)} placeholder="Geriatría" />
        <Inp label="Teléfono" value={data.phone} onChange={v => onChange('phone', v)} type="tel" placeholder="55 1234 5678" />
      </div>
      <Inp label="Consultorio / Clínica" value={data.clinic} onChange={v => onChange('clinic', v)} placeholder="Hospital General (opcional)" />
      <FormActions onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} />
    </div>
  )
}

// ── Farmacia card ─────────────────────────────────────────────────────────────
function FarmaciaCard({ farmacia, canEdit, onEdit, onDelete }) {
  return (
    <div style={{ background: '#FAF5FF', borderRadius: 14, padding: '12px 14px', marginBottom: 8, border: '1px solid #E9D5FF' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{farmacia.name}</p>
          {farmacia.address && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 2px' }}>📍 {farmacia.address}</p>}
          {farmacia.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>📱 {farmacia.phone}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={farmacia.phone} />
          {canEdit && <ActionBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function FarmaciaForm({ data, onChange, onSave, onCancel, saving }) {
  return (
    <div style={{ background: '#FAF5FF', borderRadius: 14, padding: 14, marginBottom: 8, border: '1.5px solid #7C3AED' }}>
      <Inp label="Nombre de la farmacia" value={data.name} onChange={v => onChange('name', v)} placeholder="Farmacia del Ahorro" />
      <Inp label="Teléfono" value={data.phone} onChange={v => onChange('phone', v)} type="tel" placeholder="55 1234 5678" />
      <Inp label="Dirección" value={data.address} onChange={v => onChange('address', v)} placeholder="Calle Principal 123 (opcional)" />
      <FormActions onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} accentColor="#7C3AED" />
    </div>
  )
}

// ── Contact card (emergency + friends) ───────────────────────────────────────
function ContactCard({ contact, canEdit, isEmergency, onEdit, onDelete }) {
  const cardStyle = isEmergency
    ? { background: '#FFF5F5', border: '1.5px solid #FECACA' }
    : { background: '#FAF5FF', border: '1px solid #E9D5FF' }
  return (
    <div style={{ borderRadius: 14, padding: '12px 14px', marginBottom: 8, ...cardStyle }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{contact.name}</p>
          {contact.relationship && <p style={{ fontSize: 12, color: isEmergency ? '#D63031' : '#7C3AED', margin: '0 0 2px', fontWeight: 600 }}>{contact.relationship}</p>}
          {contact.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 2px' }}>📱 {contact.phone}</p>}
          {contact.notes && <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>{contact.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <CallBtn phone={contact.phone} big={isEmergency} />
          {canEdit && <ActionBtns onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function ContactForm({ data, onChange, onSave, onCancel, saving, isEmergency }) {
  const color = isEmergency ? '#D63031' : '#7C3AED'
  const bg = isEmergency ? '#FFF5F5' : '#FAF5FF'
  const border = isEmergency ? '#FECACA' : '#C4B5FD'
  return (
    <div style={{ background: bg, borderRadius: 14, padding: 14, marginBottom: 8, border: `1.5px solid ${border}` }}>
      <Inp label="Nombre" value={data.name} onChange={v => onChange('name', v)} placeholder="Nombre completo" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Inp label={isEmergency ? 'Relación' : 'Relación / Nota'} value={data.relationship} onChange={v => onChange('relationship', v)} placeholder={isEmergency ? 'Hija, Hijo...' : 'Vecino, Amigo...'} />
        <Inp label="Teléfono" value={data.phone} onChange={v => onChange('phone', v)} type="tel" placeholder="55 1234 5678" />
      </div>
      {!isEmergency && (
        <Inp label="Notas" value={data.notes} onChange={v => onChange('notes', v)} placeholder="Ej. Trae comida los martes (opcional)" />
      )}
      <FormActions onSave={onSave} onCancel={onCancel} saving={saving} disabled={!data.name?.trim()} accentColor={color} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PatientProfileContacts({ ownerId, canEdit, initialForm, onBadgeChange }) {
  const [doctors, setDoctors]     = useState([])
  const [farmacias, setFarmacias] = useState([])
  const [emergency, setEmergency] = useState([])
  const [friends, setFriends]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState(null)
  const [editData, setEditData]   = useState({})
  const [addingTo, setAddingTo]   = useState(null)
  const [addData, setAddData]     = useState({})
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => { if (ownerId) fetchAll() }, [ownerId])

  useEffect(() => {
    onBadgeChange?.(doctors.length + farmacias.length + emergency.length + friends.length)
  }, [doctors, farmacias, emergency, friends])

  async function fetchAll() {
    setLoading(true)
    const [{ data: docs }, { data: insts }, { data: ctcs }] = await Promise.all([
      supabase.from('directory_doctors').select('*').eq('owner_id', ownerId).order('created_at'),
      supabase.from('directory_institutions').select('*').eq('owner_id', ownerId).eq('type', 'Farmacia').order('name'),
      supabase.from('directory_contacts').select('*').eq('owner_id', ownerId).order('created_at'),
    ])
    const docsArr = docs ?? []
    const ctcsArr = ctcs ?? []
    setDoctors(docsArr)
    setFarmacias(insts ?? [])
    setEmergency(ctcsArr.filter(c => c.is_emergency_contact))
    setFriends(ctcsArr.filter(c => !c.is_emergency_contact))
    if (initialForm) await migrate(docsArr, ctcsArr)
    setLoading(false)
  }

  async function migrate(existingDocs, existingCtcs) {
    const docInserts = []
    const ctcInserts = []

    if (!existingDocs.some(d => d.is_primary) && initialForm?.medico_tratante) {
      docInserts.push({ owner_id: ownerId, is_primary: true,
        name: initialForm.medico_tratante,
        specialty: initialForm.especialidad_medico || null,
        phone: initialForm.telefono_medico || null,
      })
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

  // ── Doctor CRUD ──────────────────────────────────────────────────────────────
  async function addDoctor(isPrimary) {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_doctors')
      .insert({ owner_id: ownerId, is_primary: isPrimary, name: addData.name.trim(), specialty: addData.specialty || null, phone: addData.phone || null, clinic: addData.clinic || null })
      .select().single()
    if (row) setDoctors(prev => [...prev, row])
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateDoctor(id) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_doctors')
      .update({ name: editData.name.trim(), specialty: editData.specialty || null, phone: editData.phone || null, clinic: editData.clinic || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', ownerId).select().single()
    if (row) setDoctors(prev => prev.map(d => d.id === id ? row : d))
    setEditId(null); setSaving(false)
  }

  async function deleteDoctor(id) {
    await supabase.from('directory_doctors').delete().eq('id', id).eq('owner_id', ownerId)
    setDoctors(prev => prev.filter(d => d.id !== id))
    setConfirmDel(null)
  }

  // ── Farmacia CRUD ─────────────────────────────────────────────────────────────
  async function addFarmacia() {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_institutions')
      .insert({ owner_id: ownerId, type: 'Farmacia', name: addData.name.trim(), phone: addData.phone || null, address: addData.address || null })
      .select().single()
    if (row) setFarmacias(prev => [...prev, row])
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateFarmacia(id) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_institutions')
      .update({ name: editData.name.trim(), phone: editData.phone || null, address: editData.address || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', ownerId).select().single()
    if (row) setFarmacias(prev => prev.map(f => f.id === id ? row : f))
    setEditId(null); setSaving(false)
  }

  async function deleteFarmacia(id) {
    await supabase.from('directory_institutions').delete().eq('id', id).eq('owner_id', ownerId)
    setFarmacias(prev => prev.filter(f => f.id !== id))
    setConfirmDel(null)
  }

  // ── Contact CRUD ──────────────────────────────────────────────────────────────
  async function addContact(isEmergency) {
    if (!addData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_contacts')
      .insert({ owner_id: ownerId, is_emergency_contact: isEmergency, name: addData.name.trim(), phone: addData.phone || null, relationship: addData.relationship || null, notes: addData.notes || null })
      .select().single()
    if (row) { if (isEmergency) setEmergency(prev => [...prev, row]); else setFriends(prev => [...prev, row]) }
    setAddingTo(null); setAddData({}); setSaving(false)
  }

  async function updateContact(id, isEmergency) {
    if (!editData.name?.trim()) return
    setSaving(true)
    const { data: row } = await supabase.from('directory_contacts')
      .update({ name: editData.name.trim(), phone: editData.phone || null, relationship: editData.relationship || null, notes: editData.notes || null, updated_at: new Date().toISOString() })
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

  if (loading) return <p style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando contactos...</p>

  const primaryDoctor = doctors.find(d => d.is_primary)
  const specialists   = doctors.filter(d => !d.is_primary)

  return (
    <div>
      {/* ── 👨‍⚕️ Médico de cabecera ──────────────────────────────────────────── */}
      <CatLabel icon="👨‍⚕️" title="Médico de cabecera" color="#0891B2" />

      {primaryDoctor && (
        editId === primaryDoctor.id
          ? <DoctorForm data={editData} onChange={(k, v) => setEditData(p => ({ ...p, [k]: v }))}
              onSave={() => updateDoctor(primaryDoctor.id)} onCancel={cancelEdit} saving={saving} />
          : <DoctorCard doc={primaryDoctor} canEdit={canEdit}
              onEdit={() => startEdit(primaryDoctor)}
              onDelete={() => setConfirmDel({ type: 'doctor', id: primaryDoctor.id, name: primaryDoctor.name })} />
      )}

      {!primaryDoctor && (
        addingTo === 'doctor-primary'
          ? <DoctorForm data={addData} onChange={(k, v) => setAddData(p => ({ ...p, [k]: v }))}
              onSave={() => addDoctor(true)} onCancel={cancelAdd} saving={saving} isNew />
          : canEdit && <AddBtn label="Agregar médico de cabecera" color="#0891B2" onClick={() => startAdd('doctor-primary')} />
      )}

      {/* ── 🏥 Especialistas ────────────────────────────────────────────────── */}
      <CatLabel icon="🏥" title="Especialistas" color="#0891B2" />

      {specialists.map(doc => (
        editId === doc.id
          ? <DoctorForm key={doc.id} data={editData} onChange={(k, v) => setEditData(p => ({ ...p, [k]: v }))}
              onSave={() => updateDoctor(doc.id)} onCancel={cancelEdit} saving={saving} />
          : <DoctorCard key={doc.id} doc={doc} canEdit={canEdit}
              onEdit={() => startEdit(doc)}
              onDelete={() => setConfirmDel({ type: 'doctor', id: doc.id, name: doc.name })} />
      ))}

      {addingTo === 'specialist'
        ? <DoctorForm data={addData} onChange={(k, v) => setAddData(p => ({ ...p, [k]: v }))}
            onSave={() => addDoctor(false)} onCancel={cancelAdd} saving={saving} isNew />
        : canEdit && <AddBtn label="Agregar especialista" color="#0891B2" onClick={() => startAdd('specialist')} />
      }

      {/* ── 💊 Farmacia ──────────────────────────────────────────────────────── */}
      <CatLabel icon="💊" title="Farmacia" color="#7C3AED" />

      {farmacias.map(f => (
        editId === f.id
          ? <FarmaciaForm key={f.id} data={editData} onChange={(k, v) => setEditData(p => ({ ...p, [k]: v }))}
              onSave={() => updateFarmacia(f.id)} onCancel={cancelEdit} saving={saving} />
          : <FarmaciaCard key={f.id} farmacia={f} canEdit={canEdit}
              onEdit={() => startEdit(f)}
              onDelete={() => setConfirmDel({ type: 'farmacia', id: f.id, name: f.name })} />
      ))}

      {addingTo === 'farmacia'
        ? <FarmaciaForm data={addData} onChange={(k, v) => setAddData(p => ({ ...p, [k]: v }))}
            onSave={addFarmacia} onCancel={cancelAdd} saving={saving} isNew />
        : canEdit && <AddBtn label="Agregar farmacia" color="#7C3AED" onClick={() => startAdd('farmacia')} />
      }

      {/* ── 🚨 Emergencia ────────────────────────────────────────────────────── */}
      <CatLabel icon="🚨" title="Emergencia" color="#D63031" />

      {emergency.map(c => (
        editId === c.id
          ? <ContactForm key={c.id} data={editData} onChange={(k, v) => setEditData(p => ({ ...p, [k]: v }))}
              onSave={() => updateContact(c.id, true)} onCancel={cancelEdit} saving={saving} isEmergency />
          : <ContactCard key={c.id} contact={c} canEdit={canEdit} isEmergency
              onEdit={() => startEdit(c)}
              onDelete={() => setConfirmDel({ type: 'emergency', id: c.id, name: c.name })} />
      ))}

      {addingTo === 'emergency'
        ? <ContactForm data={addData} onChange={(k, v) => setAddData(p => ({ ...p, [k]: v }))}
            onSave={() => addContact(true)} onCancel={cancelAdd} saving={saving} isNew isEmergency />
        : canEdit && <AddBtn label="Agregar contacto de emergencia" color="#D63031" onClick={() => startAdd('emergency')} />
      }

      {/* ── 👫 Amigos cercanos ────────────────────────────────────────────────── */}
      <CatLabel icon="👫" title="Amigos cercanos" color="#7C3AED" />

      {friends.map(c => (
        editId === c.id
          ? <ContactForm key={c.id} data={editData} onChange={(k, v) => setEditData(p => ({ ...p, [k]: v }))}
              onSave={() => updateContact(c.id, false)} onCancel={cancelEdit} saving={saving} />
          : <ContactCard key={c.id} contact={c} canEdit={canEdit}
              onEdit={() => startEdit(c)}
              onDelete={() => setConfirmDel({ type: 'friend', id: c.id, name: c.name })} />
      ))}

      {addingTo === 'friend'
        ? <ContactForm data={addData} onChange={(k, v) => setAddData(p => ({ ...p, [k]: v }))}
            onSave={() => addContact(false)} onCancel={cancelAdd} saving={saving} isNew />
        : canEdit && <AddBtn label="Agregar amigo o vecino de confianza" color="#7C3AED" onClick={() => startAdd('friend')} />
      }

      {/* ── Confirmación de borrado ───────────────────────────────────────────── */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🗑️</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px' }}>¿Eliminar contacto?</p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px' }}>{confirmDel.name}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={() => {
                if (confirmDel.type === 'doctor') deleteDoctor(confirmDel.id)
                else if (confirmDel.type === 'farmacia') deleteFarmacia(confirmDel.id)
                else if (confirmDel.type === 'emergency') deleteContact(confirmDel.id, true)
                else deleteContact(confirmDel.id, false)
              }} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(214,48,49,0.3)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
