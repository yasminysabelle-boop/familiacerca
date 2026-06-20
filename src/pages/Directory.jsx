import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  Plus, XIcon, Phone, Mail, MapPin, Star, Pencil, Trash,
  BookOpen, User, AlertTriangle, Users,
} from '../components/Icons'

// ── Constants ──────────────────────────────────────────────────────
const BLANK_DOC = { name: '', specialty: '', phone: '', email: '', clinic: '', notes: '' }
const BLANK_INS = { name: '', type: 'Hospital', address: '', phone: '', emergency_phone: '', website: '', notes: '' }
const BLANK_CON = { name: '', relationship: '', phone: '', email: '', address: '', is_emergency_contact: false, notes: '' }

const INST_TYPES = ['Hospital', 'Clínica', 'Consultorio', 'Laboratorio', 'Farmacia', 'Otro']

const DOCTOR_SPECIALTIES = [
  'Médico General','Cardiólogo','Neurólogo','Oncólogo','Pediatra','Geriatra','Internista',
  'Endocrinólogo','Gastroenterólogo','Nefrólogo','Neumólogo','Ortopedista','Traumatólogo',
  'Dermatólogo','Oftalmólogo','Otorrinolaringólogo','Urólogo','Ginecólogo','Obstetra',
  'Reumatólogo','Hematólogo','Infectólogo','Inmunólogo','Alergólogo','Anestesiólogo',
  'Cirujano General','Cirujano Cardiovascular','Neurocirujano','Psiquiatra','Psicólogo',
  'Nutricionista','Fisioterapeuta','Foniatra','Odontólogo','Odontólogo Especialista',
  'Enfermero/a','Otro',
]

const CONTACT_RELATIONSHIPS = [
  'Hijo/a','Padre','Madre','Hermano/a','Hermana','Esposo/a','Cuñado/a','Suegro/a',
  'Abuelo/a','Nieto/a','Tío/a','Sobrino/a','Primo/a','Padrino/Madrina',
  'Cuidador profesional','Vecino cercano','Amigo cercano','Otro',
]
const INST_TYPE_COLORS = {
  Hospital: '#D63031', Clínica: '#2D86A0', Consultorio: '#0d6b63',
  Laboratorio: '#7C5CBF', Farmacia: '#0d6b63', Otro: '#9CA3AF',
}

const F = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #EDE5D8', borderRadius: 12,
  fontSize: 14, outline: 'none', background: '#FDFAF7',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const onFocus = e => { e.target.style.borderColor = '#0d6b63'; e.target.style.boxShadow = '0 0 0 3px rgba(13,107,99,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

// ── Shared small components ────────────────────────────────────────
function InfoRow({ Icon: Ic, value, href, color }) {
  if (!value) return null
  const inner = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
      <Ic size={14} color={color ?? '#9CA3AF'} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
  return href
    ? <a href={href} style={{ display: 'block', textDecoration: 'none' }}>{inner}</a>
    : inner
}

function Label({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function FormInput({ label, value, onChange, type = 'text', placeholder, rows }) {
  return (
    <div>
      <Label>{label}</Label>
      {rows ? (
        <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={{ ...F, resize: 'none' }} onFocus={onFocus} onBlur={onBlur} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={F} onFocus={onFocus} onBlur={onBlur} />
      )}
    </div>
  )
}

function FormSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...F, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        onFocus={onFocus} onBlur={onBlur}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function CardActions({ onEdit, onDeleteRequest, canDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button onClick={onEdit} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
        <Pencil size={13} color="#6B7280" strokeWidth={1.75} />
      </button>
      {canDelete && (
        <button onClick={onDeleteRequest} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F0', border: 'none', cursor: 'pointer' }}>
          <Trash size={13} color="#D63031" strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}

function EmptyState({ Icon: Ic, title, subtitle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5EEE6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ic size={26} color="#0d6b63" strokeWidth={1.3} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', textAlign: 'center' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', maxWidth: 220, lineHeight: 1.6 }}>{subtitle}</p>
    </div>
  )
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px', borderRadius: 16, marginTop: 8,
      border: '1.5px dashed #0d6b63', background: '#FFF8F4', color: '#0d6b63',
      fontWeight: 600, fontSize: 13, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <Plus size={16} color="#0d6b63" strokeWidth={2} />
      {label}
    </button>
  )
}

function SheetModal({ title, subtitle, onClose, onSave, saveLabel, saving, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '24px 24px 0 0', padding: '28px 24px 96px', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)', maxHeight: '92svh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{title}</p>
            {subtitle && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
            <XIcon size={16} color="#6B7280" strokeWidth={2} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
        <button onClick={onSave} disabled={saving} style={{
          width: '100%', marginTop: 24, padding: '14px', borderRadius: 16, border: 'none',
          background: saving ? '#C0CCC5' : 'linear-gradient(135deg, #0d6b63, #3A6347)',
          color: 'white', fontWeight: 700, fontSize: 14,
          cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: saving ? 'none' : '0 6px 20px rgba(13,107,99,0.3)',
        }}>
          {saving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  )
}

// ── Doctor card ────────────────────────────────────────────────────
function DoctorCard({ doc, onEdit, onDeleteRequest, canDelete }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', borderTop: '3px solid #0d6b63', padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{doc.name}</p>
          {doc.specialty && <p style={{ fontSize: 12, fontWeight: 600, color: '#0d6b63', marginTop: 2 }}>{doc.specialty}</p>}
        </div>
        <CardActions onEdit={onEdit} onDeleteRequest={onDeleteRequest} canDelete={canDelete} />
      </div>
      <InfoRow Icon={Phone}   value={doc.phone}  href={doc.phone  ? `tel:${doc.phone}`      : undefined} />
      <InfoRow Icon={Mail}    value={doc.email}  href={doc.email  ? `mailto:${doc.email}`   : undefined} />
      <InfoRow Icon={BookOpen} value={doc.clinic} />
      {doc.notes && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #F3F4F6', lineHeight: 1.5 }}>{doc.notes}</p>}
    </div>
  )
}

// ── Institution card ───────────────────────────────────────────────
function InstitutionCard({ ins, onEdit, onDeleteRequest, canDelete }) {
  const typeColor = INST_TYPE_COLORS[ins.type] ?? '#9CA3AF'
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', borderTop: `3px solid ${typeColor}`, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{ins.name}</p>
            {ins.type && (
              <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: `${typeColor}14`, padding: '2px 8px', borderRadius: 6 }}>
                {ins.type}
              </span>
            )}
          </div>
        </div>
        <CardActions onEdit={onEdit} onDeleteRequest={onDeleteRequest} canDelete={canDelete} />
      </div>
      <InfoRow Icon={MapPin} value={ins.address} />
      <InfoRow Icon={Phone}  value={ins.phone} href={ins.phone ? `tel:${ins.phone}` : undefined} />
      {ins.emergency_phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Phone size={14} color="#D63031" strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <a href={`tel:${ins.emergency_phone}`} style={{ fontSize: 12, color: '#D63031', fontWeight: 600, textDecoration: 'none' }}>
            {ins.emergency_phone} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(emergencias)</span>
          </a>
        </div>
      )}
      {ins.website && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>🌐</span>
          <a href={ins.website.startsWith('http') ? ins.website : `https://${ins.website}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#2D86A0', textDecoration: 'none', wordBreak: 'break-all' }}>
            {ins.website}
          </a>
        </div>
      )}
      {ins.notes && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #F3F4F6', lineHeight: 1.5 }}>{ins.notes}</p>}
    </div>
  )
}

// ── Family contact card ────────────────────────────────────────────
function ContactCard({ con, onEdit, onToggleEmergency, onDeleteRequest, canDelete }) {
  const isEmergency = con.is_emergency_contact
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 10,
      border: isEmergency ? '1.5px solid #FECACA' : '1px solid #EDE5D8',
      borderTop: `3px solid ${isEmergency ? '#D63031' : '#0d6b63'}`,
      boxShadow: isEmergency ? '0 2px 12px rgba(214,48,49,0.1)' : '0 2px 8px rgba(0,0,0,0.05)',
    }}>
      {isEmergency && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#D63031', letterSpacing: '0.1em' }}>⭐ EMERGENCIA</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{con.name}</p>
          {con.relationship && <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{con.relationship}</p>}
        </div>
        <CardActions onEdit={onEdit} onDeleteRequest={onDeleteRequest} canDelete={canDelete} />
      </div>
      <InfoRow Icon={Phone}  value={con.phone}   href={con.phone  ? `tel:${con.phone}`    : undefined} />
      <InfoRow Icon={Mail}   value={con.email}   href={con.email  ? `mailto:${con.email}` : undefined} />
      <InfoRow Icon={MapPin} value={con.address} />
      {con.notes && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #F3F4F6', lineHeight: 1.5 }}>{con.notes}</p>}

      {/* Emergency call button */}
      {isEmergency && con.phone && (
        <a href={`tel:${con.phone}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginTop: 12, padding: '11px', borderRadius: 12,
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          color: 'white', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
        }}>
          <Phone size={16} color="white" strokeWidth={2} />
          Llamar ahora
        </a>
      )}

      <button onClick={() => onToggleEmergency(con)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: isEmergency && con.phone ? 8 : 10,
        padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
        background: isEmergency ? '#FFF0F0' : '#F9F5F1',
        border: isEmergency ? '1px solid #FECACA' : '1px solid #EDE5D8',
        color: isEmergency ? '#D63031' : '#9CA3AF',
        fontSize: 11, fontWeight: 600,
      }}>
        <Star size={11} color={isEmergency ? '#D63031' : '#9CA3AF'} strokeWidth={1.75} filled={isEmergency} />
        {isEmergency ? 'Quitar como emergencia' : 'Marcar como emergencia'}
      </button>
    </div>
  )
}

function JoinedMemberCard({ member, inDirectory, onClick }) {
  const roleLabel  = member.role === 'cuidador' ? 'Cuidador' : 'Familiar'
  const roleColor  = member.role === 'cuidador' ? '#0d6b63' : '#7C5CBF'
  const roleBg     = member.role === 'cuidador' ? '#F0FDF4' : '#EDE9FE'
  const roleBorder = member.role === 'cuidador' ? '#BBF7D0' : '#C4B5FD'
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 14,
        border: '1.5px solid #BFDBFE',
        padding: '12px 14px', marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#2563EB',
        }}>
          {member.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{member.name}</p>
          {member.email && (
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.email}
            </p>
          )}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: roleColor,
          background: roleBg, border: `1px solid ${roleBorder}`,
          padding: '3px 9px', borderRadius: 20, flexShrink: 0,
        }}>
          {roleLabel}
        </span>
      </div>
      <p style={{ fontSize: 11, color: inDirectory ? '#0d6b63' : '#0d6b63', margin: '8px 0 0', fontWeight: 600 }}>
        {inDirectory ? '✓ En directorio — toca para editar' : '+ Toca para añadir al directorio'}
      </p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function Directory() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const isAdmin = user?.id === ownerId
  const canEdit = memberRole === null || memberRole === 'cuidador'
  const [searchParams] = useSearchParams()
  const autoOpenEmail = searchParams.get('member')
  const autoOpenedRef = useRef(false)

  const [tab, setTab] = useState('medicos')
  const [doctors,      setDoctors]      = useState([])
  const [institutions, setInstitutions] = useState([])
  const [contacts,      setContacts]      = useState([])
  const [familyMembers, setFamilyMembers] = useState([])
  const [patientProfile, setPatientProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  async function getCroppedBlob(imageSrc, pixelCrop) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = imageSrc
    })
    const canvas = document.createElement('canvas')
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  }

  function openCropModal(file) {
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return
    const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
    URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    await uploadPatientPhoto(blob)
  }

  function handleCropCancel() {
    URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function uploadPatientPhoto(file) {
    if (!file || !patientProfile?.id) return
    setPhotoUploading(true)
    try {
      const path = `${patientProfile.id}/photo.jpg`
      const { error: upErr } = await supabase.storage
        .from('patient-photos')
        .upload(path, file, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('patient_profiles')
        .update({ photo_url: publicUrl })
        .eq('id', patientProfile.id)
      if (updErr) throw updErr
      console.log('photo_url updated:', publicUrl)
      setPatientProfile(prev => ({ ...prev, photo_url: `${publicUrl}?t=${Date.now()}` }))
      window.dispatchEvent(new CustomEvent('patientProfileUpdated'))
    } catch (e) {
      console.error('Photo upload failed', e)
    } finally {
      setPhotoUploading(false)
    }
  }

  // Doctor form state
  const [docModal, setDocModal] = useState(false)
  const [editDoc,  setEditDoc]  = useState(null)
  const [docForm,  setDocForm]  = useState(BLANK_DOC)
  const [savingDoc, setSavingDoc] = useState(false)

  // Institution form state
  const [insModal, setInsModal] = useState(false)
  const [editIns,  setEditIns]  = useState(null)
  const [insForm,  setInsForm]  = useState(BLANK_INS)
  const [savingIns, setSavingIns] = useState(false)

  // Contact form state
  const [conModal, setConModal] = useState(false)
  const [editCon,  setEditCon]  = useState(null)
  const [conForm,  setConForm]  = useState(BLANK_CON)
  const [savingCon, setSavingCon] = useState(false)

  useEffect(() => { if (ownerId) fetchAll() }, [ownerId])

  // Auto-open a contact when arriving from Familia with ?member=email
  useEffect(() => {
    if (loading || !autoOpenEmail || autoOpenedRef.current) return
    autoOpenedRef.current = true
    const email = decodeURIComponent(autoOpenEmail)
    const match = familyMembers.find(m => m.email?.toLowerCase() === email.toLowerCase())
    handleMemberTap(match ?? { name: email.split('@')[0], email })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, autoOpenEmail])

  // Realtime: refresh familiares on any membership change (join, role update, removal)
  useEffect(() => {
    if (!ownerId) return
    const channel = supabase
      .channel(`dir_family_members_${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `user_id=eq.${ownerId}` }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ownerId])

  async function fetchAll() {
    setLoading(true)
    setLoadError('')
    try {
      const [{ data: docs, error: e1 }, { data: inss, error: e2 }, { data: cons, error: e3 }, { data: members }, { data: pp }] = await Promise.all([
        supabase.from('directory_doctors').select('*').eq('owner_id', ownerId).order('name'),
        supabase.from('directory_institutions').select('*').eq('owner_id', ownerId).order('name'),
        supabase.from('directory_contacts').select('*').eq('owner_id', ownerId).order('name'),
        supabase.from('family_members').select('member_user_id, member_email, role, joined_at').eq('user_id', ownerId).not('member_user_id', 'is', null),
        supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
      ])
      if (e1 || e2 || e3) throw e1 ?? e2 ?? e3
      setDoctors(docs ?? [])
      setInstitutions(inss ?? [])
      setContacts(cons ?? [])
      setPatientProfile(pp ?? null)

      // Enrich family members with names from user_profiles
      if (members?.length) {
        const uids = members.map(m => m.member_user_id)
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', uids)
        const profileMap = {}
        profiles?.forEach(p => { profileMap[p.id] = p.full_name })
        setFamilyMembers(members.map(m => ({
          id: m.member_user_id,
          name: profileMap[m.member_user_id] || m.member_email?.split('@')[0] || '—',
          email: m.member_email ?? '',
          role: m.role ?? 'familiar',
          joinedAt: m.joined_at,
        })))
      } else {
        setFamilyMembers([])
      }
    } catch {
      setLoadError('No se pudo cargar el directorio. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  // ── Doctor CRUD ───────────────────────────────────────────────────
  function openDoc(d = null) {
    setEditDoc(d)
    setDocForm(d ? { name: d.name, specialty: d.specialty ?? '', phone: d.phone ?? '', email: d.email ?? '', clinic: d.clinic ?? '', notes: d.notes ?? '' } : BLANK_DOC)
    setDocModal(true)
  }

  async function saveDoc() {
    if (!docForm.name.trim()) return
    setSavingDoc(true)
    if (editDoc) {
      await supabase.from('directory_doctors').update({ ...docForm, updated_at: new Date().toISOString() }).eq('id', editDoc.id)
    } else {
      await supabase.from('directory_doctors').insert({ ...docForm, owner_id: ownerId })
    }
    setSavingDoc(false)
    setDocModal(false)
    fetchAll()
  }

  // ── Institution CRUD ──────────────────────────────────────────────
  function openIns(i = null) {
    setEditIns(i)
    setInsForm(i ? { name: i.name, type: i.type ?? 'Hospital', address: i.address ?? '', phone: i.phone ?? '', emergency_phone: i.emergency_phone ?? '', website: i.website ?? '', notes: i.notes ?? '' } : BLANK_INS)
    setInsModal(true)
  }

  async function saveIns() {
    if (!insForm.name.trim()) return
    setSavingIns(true)
    if (editIns) {
      await supabase.from('directory_institutions').update({ ...insForm, updated_at: new Date().toISOString() }).eq('id', editIns.id)
    } else {
      await supabase.from('directory_institutions').insert({ ...insForm, owner_id: ownerId })
    }
    setSavingIns(false)
    setInsModal(false)
    fetchAll()
  }

  // ── Contact CRUD ──────────────────────────────────────────────────
  function openCon(c = null, prefill = {}) {
    setEditCon(c)
    setConForm(c
      ? { name: c.name, relationship: c.relationship ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', is_emergency_contact: c.is_emergency_contact, notes: c.notes ?? '' }
      : { ...BLANK_CON, ...prefill }
    )
    setConModal(true)
  }

  function handleMemberTap(member) {
    const existing = contacts.find(c =>
      c.email && member.email &&
      c.email.toLowerCase() === member.email.toLowerCase()
    )
    openCon(existing ?? null, { name: member.name, email: member.email })
  }

  async function saveCon() {
    if (!conForm.name.trim()) return
    setSavingCon(true)
    if (conForm.is_emergency_contact) {
      await supabase.from('directory_contacts').update({ is_emergency_contact: false }).eq('owner_id', ownerId)
    }
    if (editCon) {
      await supabase.from('directory_contacts').update({ ...conForm, updated_at: new Date().toISOString() }).eq('id', editCon.id)
    } else {
      await supabase.from('directory_contacts').insert({ ...conForm, owner_id: ownerId })
    }
    setSavingCon(false)
    setConModal(false)
    fetchAll()
  }

  async function deleteItem(table, id) {
    await supabase.from(table).delete().eq('id', id)
    setConfirmDialog(null)
    fetchAll()
  }

  async function toggleEmergency(contact) {
    if (contact.is_emergency_contact) {
      await supabase.from('directory_contacts').update({ is_emergency_contact: false }).eq('id', contact.id)
    } else {
      await supabase.from('directory_contacts').update({ is_emergency_contact: false }).eq('owner_id', ownerId)
      await supabase.from('directory_contacts').update({ is_emergency_contact: true }).eq('id', contact.id)
    }
    fetchAll()
  }

  const emergency = contacts.find(c => c.is_emergency_contact)
  const topInstitutions = institutions.filter(i => i.emergency_phone).slice(0, 2)

  const TABS = [
    { id: 'medicos',       label: 'Médicos'   },
    { id: 'instituciones', label: 'Lugares'   },
    { id: 'familiares',    label: 'Familia'   },
    { id: 'paciente',      label: 'Paciente'  },
    { id: 'emergencia',    label: '🆘', accent: '#D63031' },
  ]

  return (
    <Layout>
      {/* Sticky tab bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#F7F3ED', borderBottom: '1px solid #EDE5D8', padding: '12px 16px 10px' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 16, background: '#F3F4F6' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '7px 4px', borderRadius: 12,
              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? (t.accent ?? '#1A1A1A') : '#9CA3AF',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 48px' }}>

        {/* ── Médicos ───────────────────────────────────────────── */}
        {tab === 'medicos' && (
          <>
            {loading
              ? <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0' }}>Cargando...</p>
              : loadError
              ? <div style={{ textAlign: 'center', padding: '32px 0' }}><p style={{ fontSize: 13, color: '#D63031', marginBottom: 10 }}>{loadError}</p><button onClick={fetchAll} style={{ padding: '9px 20px', borderRadius: 12, background: '#0d6b63', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Reintentar</button></div>
              : doctors.length === 0
              ? <EmptyState Icon={BookOpen} title="Sin médicos registrados" subtitle="Agrega los médicos tratantes para tenerlos siempre a la mano" />
              : doctors.map(d => (
                <DoctorCard key={d.id} doc={d}
                  onEdit={() => openDoc(d)}
                  canDelete={isAdmin}
                  onDeleteRequest={() => setConfirmDialog({ onConfirm: () => deleteItem('directory_doctors', d.id) })} />
              ))
            }
            <AddBtn onClick={() => openDoc()} label="Agregar médico" />
          </>
        )}

        {/* ── Instituciones ─────────────────────────────────────── */}
        {tab === 'instituciones' && (
          <>
            {loading
              ? <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0' }}>Cargando...</p>
              : loadError
              ? <div style={{ textAlign: 'center', padding: '32px 0' }}><p style={{ fontSize: 13, color: '#D63031', marginBottom: 10 }}>{loadError}</p><button onClick={fetchAll} style={{ padding: '9px 20px', borderRadius: 12, background: '#0d6b63', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Reintentar</button></div>
              : institutions.length === 0
              ? <EmptyState Icon={BookOpen} title="Sin instituciones registradas" subtitle="Agrega hospitales, clínicas y farmacias de referencia" />
              : institutions.map(i => (
                <InstitutionCard key={i.id} ins={i}
                  onEdit={() => openIns(i)}
                  canDelete={isAdmin}
                  onDeleteRequest={() => setConfirmDialog({ onConfirm: () => deleteItem('directory_institutions', i.id) })} />
              ))
            }
            <AddBtn onClick={() => openIns()} label="Agregar institución" />
          </>
        )}

        {/* ── Familiares ────────────────────────────────────────── */}
        {tab === 'familiares' && (
          <>
            {loading
              ? <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0' }}>Cargando...</p>
              : loadError
              ? <div style={{ textAlign: 'center', padding: '32px 0' }}><p style={{ fontSize: 13, color: '#D63031', marginBottom: 10 }}>{loadError}</p><button onClick={fetchAll} style={{ padding: '9px 20px', borderRadius: 12, background: '#0d6b63', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Reintentar</button></div>
              : (
                <>
                  {/* Joined app members */}
                  {familyMembers.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Con acceso al app
                      </p>
                      {familyMembers.map(m => {
                        const inDirectory = contacts.some(c =>
                          c.email && m.email && c.email.toLowerCase() === m.email.toLowerCase()
                        )
                        return (
                          <JoinedMemberCard
                            key={m.id}
                            member={m}
                            inDirectory={inDirectory}
                            onClick={() => handleMemberTap(m)}
                          />
                        )
                      })}
                    </div>
                  )}

                  {/* Manual directory contacts */}
                  {contacts.length > 0 ? (
                    <div>
                      {familyMembers.length > 0 && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                          Directorio
                        </p>
                      )}
                      {contacts.map(c => (
                        <ContactCard key={c.id} con={c}
                          onEdit={() => openCon(c)}
                          onToggleEmergency={toggleEmergency}
                          canDelete={isAdmin}
                          onDeleteRequest={() => setConfirmDialog({ onConfirm: () => deleteItem('directory_contacts', c.id) })} />
                      ))}
                    </div>
                  ) : familyMembers.length === 0 ? (
                    <EmptyState Icon={Users} title="Sin contactos registrados" subtitle="Agrega familiares y designa un contacto de emergencia" />
                  ) : null}
                </>
              )
            }
            <AddBtn onClick={() => openCon()} label="Agregar familiar" />
          </>
        )}

        {/* ── Paciente ──────────────────────────────────────────── */}
        {tab === 'paciente' && (
          <div>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0' }}>Cargando...</p>
            ) : !patientProfile?.nombre_completo ? (
              <div>
                <EmptyState Icon={User} title="Perfil del paciente vacío" subtitle="Agrega diagnósticos, alergias y médico tratante para tenerlos siempre disponibles" />
                {canEdit && (
                  <Link
                    to="/paciente/perfil"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px', borderRadius: 16, marginTop: 4,
                      background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
                      color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(13,107,99,0.3)',
                    }}
                  >
                    Completar perfil del paciente →
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {/* Header card */}
                <div style={{
                  background: 'linear-gradient(135deg, #0d6b63, #2E5240)',
                  borderRadius: 18, padding: '18px 20px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Patient photo */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) openCropModal(f) }}
                      />
                      <div
                        onClick={() => canEdit && photoInputRef.current?.click()}
                        style={{
                          width: 64, height: 64, borderRadius: '50%',
                          overflow: 'hidden', border: '3px solid rgba(255,255,255,0.4)',
                          cursor: canEdit ? 'pointer' : 'default',
                          background: 'rgba(255,255,255,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {(patientProfile.photo_url || patientProfile.foto_url) ? (
                          <img src={patientProfile.photo_url || patientProfile.foto_url} alt={patientProfile.nombre_completo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.7)' }}>
                            {patientProfile.nombre_completo?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div
                          onClick={() => photoInputRef.current?.click()}
                          style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 22, height: 22, borderRadius: '50%',
                            background: photoUploading ? '#9CA3AF' : '#E9826E',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, cursor: 'pointer', border: '2px solid white',
                          }}
                        >
                          {photoUploading ? '⏳' : '📷'}
                        </div>
                      )}
                    </div>

                    {/* Name + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.2 }}>
                        {patientProfile.nombre_completo}
                      </p>
                      {patientProfile.fecha_nacimiento && (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>
                          {new Date(patientProfile.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {patientProfile.sexo ? ` · ${patientProfile.sexo.charAt(0).toUpperCase() + patientProfile.sexo.slice(1)}` : ''}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <Link
                        to="/paciente/perfil"
                        style={{
                          padding: '7px 14px', borderRadius: 20,
                          background: 'rgba(255,255,255,0.15)',
                          border: '1px solid rgba(255,255,255,0.25)',
                          color: 'white', fontSize: 12, fontWeight: 600,
                          textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        Editar
                      </Link>
                    )}
                  </div>
                </div>

                {/* Alergias — destacadas primero */}
                {patientProfile.alergias?.length > 0 && (
                  <div style={{
                    background: '#FFF0F0', border: '1.5px solid #FECACA',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                      ⚠ Alergias
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {patientProfile.alergias.map(a => (
                        <span key={a} style={{
                          padding: '5px 11px', borderRadius: 20,
                          background: 'white', border: '1px solid #FECACA',
                          color: '#DC2626', fontSize: 13, fontWeight: 600,
                        }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diagnóstico */}
                {patientProfile.diagnostico_principal && (
                  <div style={{ background: 'white', border: '1px solid #EDE5D8', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                      Diagnóstico principal
                    </p>
                    <p style={{ fontSize: 14, color: '#1F2937', margin: 0, lineHeight: 1.5 }}>{patientProfile.diagnostico_principal}</p>
                  </div>
                )}

                {/* Condiciones secundarias */}
                {patientProfile.condiciones_secundarias?.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid #EDE5D8', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                      Condiciones secundarias
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {patientProfile.condiciones_secundarias.map(c => (
                        <span key={c} style={{
                          padding: '4px 10px', borderRadius: 20,
                          background: '#EBF3EE', color: '#2E5240', fontSize: 13, fontWeight: 600,
                        }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Médico tratante */}
                {patientProfile.medico_tratante && (
                  <div style={{ background: 'white', border: '1px solid #EDE5D8', borderTop: '3px solid #2563EB', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                    <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>
                      {patientProfile.medico_tratante}
                    </p>
                    {patientProfile.especialidad_medico && (
                      <p style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, margin: '0 0 6px' }}>{patientProfile.especialidad_medico}</p>
                    )}
                    {patientProfile.telefono_medico && (
                      <a href={`tel:${patientProfile.telefono_medico}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textDecoration: 'none' }}>
                        <Phone size={13} color="#2563EB" strokeWidth={2} />
                        <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>{patientProfile.telefono_medico}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Notas generales */}
                {patientProfile.notas_generales && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                      Notas
                    </p>
                    <p style={{ fontSize: 13, color: '#78350F', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{patientProfile.notas_generales}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Emergencia ────────────────────────────────────────── */}
        {tab === 'emergencia' && (
          <div>
            {/* Emergency contact hero */}
            {emergency ? (
              <div style={{ background: 'linear-gradient(145deg, #D63031, #A52020)', borderRadius: 20, padding: '24px 20px', marginBottom: 14, boxShadow: '0 8px 32px rgba(214,48,49,0.25)', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28 }}>
                  👤
                </div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>{emergency.name}</p>
                {emergency.relationship && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>{emergency.relationship}</p>}
                {emergency.phone && <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em', margin: 0 }}>{emergency.phone}</p>}
              </div>
            ) : (
              <div style={{ background: '#FFF0F0', border: '1.5px solid #FECACA', borderRadius: 16, padding: '20px', marginBottom: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#D63031', marginBottom: 4 }}>Sin contacto de emergencia</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>Ve a Familiares y marca uno como contacto de emergencia</p>
                <button onClick={() => setTab('familiares')} style={{ padding: '8px 20px', borderRadius: 10, background: '#D63031', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Ir a Familiares →
                </button>
              </div>
            )}

            {/* Call & email buttons */}
            {emergency?.phone && (
              <a href={`tel:${emergency.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px', borderRadius: 16, background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 24px rgba(34,197,94,0.35)', marginBottom: 10 }}>
                <Phone size={20} color="white" strokeWidth={2} />
                Llamar ahora
              </a>
            )}
            {emergency?.email && (
              <a href={`mailto:${emergency.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 14, background: 'white', border: '1.5px solid #EDE5D8', color: '#374151', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 16 }}>
                <Mail size={15} color="#6B7280" strokeWidth={1.75} />
                Enviar correo
              </a>
            )}

            {/* Top institutions with emergency phones */}
            {topInstitutions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Instituciones de emergencia
                </p>
                {topInstitutions.map(ins => (
                  <div key={ins.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE5D8', padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>{ins.name}</p>
                        {ins.type && <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{ins.type}</p>}
                      </div>
                      <a href={`tel:${ins.emergency_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: '#FFF0F0', border: '1px solid #FECACA', color: '#D63031', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        <Phone size={13} color="#D63031" strokeWidth={2} />
                        {ins.emergency_phone}
                      </a>
                    </div>
                  </div>
                ))}
                {institutions.filter(i => i.emergency_phone).length === 0 && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
                    Agrega instituciones con teléfono de emergencia para verlas aquí.
                  </p>
                )}
              </div>
            )}

            {/* SOS reminder */}
            <div style={{ background: 'linear-gradient(135deg, #1F2937, #111827)', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #D63031, #B82020)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 12px rgba(214,48,49,0.5)', fontSize: 12, fontWeight: 900, color: 'white', letterSpacing: '0.04em' }}>
                SOS
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>Botón SOS en el inicio</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                  El botón rojo en el Dashboard alerta a toda la familia al instante.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirmation dialog ───────────────────────────────────── */}
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.52)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 10 }}>
              ¿Eliminar este registro?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: '1.5px solid #EDE5D8', background: 'white',
                  fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: 'none', background: '#D63031',
                  fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor modal ───────────────────────────────────────────── */}
      {docModal && (
        <SheetModal title={editDoc ? 'Editar médico' : 'Nuevo médico'} subtitle="Los datos son visibles para todo el equipo de cuidado" onClose={() => setDocModal(false)} onSave={saveDoc} saveLabel={editDoc ? 'Guardar cambios' : 'Agregar médico'} saving={savingDoc}>
          <FormInput label="Nombre completo *" value={docForm.name}      onChange={v => setDocForm(f => ({ ...f, name: v }))}      placeholder="Dr. Ana García" />
          <FormSelect label="Especialidad"      value={docForm.specialty} onChange={v => setDocForm(f => ({ ...f, specialty: v }))} options={DOCTOR_SPECIALTIES} placeholder="Seleccionar especialidad" />
          <FormInput label="Teléfono"           value={docForm.phone}     onChange={v => setDocForm(f => ({ ...f, phone: v }))}     placeholder="555-123-4567" type="tel" />
          <FormInput label="Correo"             value={docForm.email}     onChange={v => setDocForm(f => ({ ...f, email: v }))}     placeholder="medico@hospital.com" type="email" />
          <FormInput label="Clínica / Hospital" value={docForm.clinic}    onChange={v => setDocForm(f => ({ ...f, clinic: v }))}    placeholder="Hospital General del Norte" />
          <FormInput label="Notas"              value={docForm.notes}     onChange={v => setDocForm(f => ({ ...f, notes: v }))}     placeholder="Próxima cita, horario de consulta…" rows={3} />
        </SheetModal>
      )}

      {/* ── Institution modal ─────────────────────────────────────── */}
      {insModal && (
        <SheetModal title={editIns ? 'Editar institución' : 'Nueva institución'} subtitle="Hospitales, clínicas y farmacias de referencia" onClose={() => setInsModal(false)} onSave={saveIns} saveLabel={editIns ? 'Guardar cambios' : 'Agregar institución'} saving={savingIns}>
          <FormInput label="Nombre *"  value={insForm.name}    onChange={v => setInsForm(f => ({ ...f, name: v }))}    placeholder="Hospital General del Norte" />
          <FormSelect label="Tipo"     value={insForm.type}    onChange={v => setInsForm(f => ({ ...f, type: v }))}    options={INST_TYPES} />
          <FormInput label="Dirección" value={insForm.address} onChange={v => setInsForm(f => ({ ...f, address: v }))} placeholder="Av. Principal 123, Col. Centro" />
          <FormInput label="Teléfono principal"    value={insForm.phone}           onChange={v => setInsForm(f => ({ ...f, phone: v }))}           placeholder="555-000-1234" type="tel" />
          <FormInput label="Teléfono de emergencia" value={insForm.emergency_phone} onChange={v => setInsForm(f => ({ ...f, emergency_phone: v }))} placeholder="911 o línea directa" type="tel" />
          <FormInput label="Sitio web" value={insForm.website} onChange={v => setInsForm(f => ({ ...f, website: v }))} placeholder="www.hospital.com" />
          <FormInput label="Notas"     value={insForm.notes}   onChange={v => setInsForm(f => ({ ...f, notes: v }))}   placeholder="Urgencias 24h, especialidades…" rows={2} />
        </SheetModal>
      )}

      {/* ── Contact modal ─────────────────────────────────────────── */}
      {conModal && (
        <SheetModal title={editCon ? 'Editar contacto' : 'Nuevo familiar'} subtitle="Agrega personas de confianza del equipo de cuidado" onClose={() => setConModal(false)} onSave={saveCon} saveLabel={editCon ? 'Guardar cambios' : 'Agregar familiar'} saving={savingCon}>
          <FormInput label="Nombre *"   value={conForm.name}         onChange={v => setConForm(f => ({ ...f, name: v }))}         placeholder="María López" />
          <FormSelect label="Parentesco" value={conForm.relationship} onChange={v => setConForm(f => ({ ...f, relationship: v }))} options={CONTACT_RELATIONSHIPS} placeholder="Seleccionar parentesco" />
          <FormInput label="Teléfono"   value={conForm.phone}        onChange={v => setConForm(f => ({ ...f, phone: v }))}        placeholder="555-678-9012" type="tel" />
          <FormInput label="Correo"     value={conForm.email}        onChange={v => setConForm(f => ({ ...f, email: v }))}        placeholder="familiar@correo.com" type="email" />
          <FormInput label="Dirección"  value={conForm.address}      onChange={v => setConForm(f => ({ ...f, address: v }))}      placeholder="Calle Robles 45, Col. Centro" />
          <FormInput label="Notas"      value={conForm.notes}        onChange={v => setConForm(f => ({ ...f, notes: v }))}        placeholder="Disponible fines de semana…" rows={2} />

          {/* Emergency toggle */}
          <button type="button" onClick={() => setConForm(f => ({ ...f, is_emergency_contact: !f.is_emergency_contact }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: conForm.is_emergency_contact ? '#FFF0F0' : '#F9F5F1',
              border: conForm.is_emergency_contact ? '1.5px solid #FECACA' : '1.5px solid #EDE5D8',
            }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: conForm.is_emergency_contact ? '#D63031' : 'white', border: conForm.is_emergency_contact ? 'none' : '1.5px solid #EDE5D8' }}>
              {conForm.is_emergency_contact && <span style={{ color: 'white', fontSize: 12 }}>★</span>}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: conForm.is_emergency_contact ? '#D63031' : '#374151', margin: 0 }}>Contacto de emergencia</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Solo puede haber uno — reemplaza al anterior</p>
            </div>
          </button>
        </SheetModal>
      )}

      {/* ── Photo crop modal ─────────────────────────────────────── */}
      {cropSrc && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: '#000', display: 'flex', flexDirection: 'column',
        }}>
          {/* Cropper area */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={3 / 2}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Bottom controls */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, padding: '20px 24px',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            background: 'rgba(0,0,0,0.85)',
          }}>
            <button
              onClick={handleCropCancel}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 600, color: '#6D7B74', padding: '12px 20px',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCropConfirm}
              disabled={photoUploading}
              style={{
                background: photoUploading ? '#9CA3AF' : '#0B4F4A',
                border: 'none', borderRadius: 999, cursor: photoUploading ? 'default' : 'pointer',
                fontSize: 15, fontWeight: 700, color: 'white',
                padding: '12px 32px',
                opacity: photoUploading ? 0.7 : 1,
              }}
            >
              {photoUploading ? 'Subiendo…' : 'Usar foto'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
