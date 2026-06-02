import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'

// ── Color palette ─────────────────────────────────────────────────────────────
const G  = [45, 74, 30]    // #2D4A1E forest green
const GM = [74, 124, 89]   // #4A7C59 mid green
const DK = [26, 26, 26]    // #1A1A1A dark
const GR = [107, 114, 128] // #6B7280 gray
const RD = [214, 48, 49]   // #D63031 red
const BD = [237, 229, 216] // #EDE5D8 border

const W = 210, H = 297, M = 15, CW = W - 2 * M

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob + 'T12:00:00'), t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--
  return a
}

function fmtDate(s) {
  if (!s) return ''
  try { return new Date((s + '').slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return s }
}

function todayStr() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── PDF builder ───────────────────────────────────────────────────────────────
export async function generateMedicalReport({ patient, meds, stock, notes, appts, doctors, insts, contacts }, careProfileName) {
  const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const name = patient?.nombre_completo || careProfileName || 'Paciente'
  const today = todayStr()
  let pageNum = 1
  let y = M

  // ── Internal helpers ────────────────────────────────────────────────────────
  function footer() {
    pdf.setFontSize(7); pdf.setTextColor(...GR)
    pdf.text(`Generado por FamiliaCerca · familiacerca.com · ${today}`, M, H - 8)
    pdf.text(`Pág. ${pageNum}`, W - M, H - 8, { align: 'right' })
  }

  function topStrip() {
    pdf.setFillColor(...G); pdf.rect(0, 0, W, 9, 'F')
    pdf.setFontSize(7); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255)
    pdf.text('FamiliaCerca', M, 6)
    pdf.setFont(undefined, 'normal')
    pdf.text(name, W - M, 6, { align: 'right' })
    y = 16
  }

  function newPage() {
    footer(); pdf.addPage(); pageNum++; topStrip()
  }

  function checkY(need) { if (y + need > H - 18) newPage() }

  function bold(on) { pdf.setFont(undefined, on ? 'bold' : 'normal') }

  function secHeader(title) {
    checkY(12)
    pdf.setFillColor(...G); pdf.rect(M, y, CW, 8, 'F')
    pdf.setFontSize(10); bold(true); pdf.setTextColor(255, 255, 255)
    pdf.text(title, M + 3, y + 5.5); bold(false)
    y += 11
  }

  function txt(text, size, color, x, w, indent = 0) {
    if (!text) return 0
    pdf.setFontSize(size); pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(String(text), w ?? CW)
    checkY(lines.length * (size * 0.4))
    pdf.text(lines, x ?? M + indent, y)
    const h = lines.length * (size * 0.42) + 1
    y += h
    return h
  }

  function kv(label, value, maxW = CW - 5) {
    if (!value) return
    checkY(8)
    pdf.setFontSize(8)
    bold(true); pdf.setTextColor(...GR)
    pdf.text(label.toUpperCase() + ':', M, y)
    bold(false); pdf.setTextColor(...DK)
    const lines = pdf.splitTextToSize(String(value), maxW - 30)
    pdf.text(lines, M + 28, y)
    y += Math.max(lines.length * 4, 5)
  }

  function contactRow(nm, sub1, sub2, phone, red = false) {
    checkY(13)
    pdf.setFillColor(248, 248, 246); pdf.rect(M, y, CW, 11, 'F')
    pdf.setFontSize(9.5); bold(true)
    pdf.setTextColor(...(red ? RD : G))
    pdf.text(nm, M + 2, y + 5); bold(false)
    pdf.setFontSize(7.5); pdf.setTextColor(...GR)
    if (sub1) pdf.text(sub1, M + 2, y + 9)
    if (sub2) pdf.text(sub2, M + CW / 2, y + 9)
    if (phone) {
      pdf.setFontSize(8)
      pdf.setTextColor(...(red ? RD : GM))
      pdf.text(`📞 ${phone}`, W - M - 2, y + 5, { align: 'right' })
    }
    y += 13
  }

  function gap(h = 4) { y += h }

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTADA
  // ═══════════════════════════════════════════════════════════════════════════
  // Green hero
  pdf.setFillColor(...G); pdf.rect(0, 0, W, 72, 'F')

  // Brand
  pdf.setFontSize(14); bold(true); pdf.setTextColor(255, 255, 255)
  pdf.text('FamiliaCerca', M, 22)
  pdf.setFontSize(9); bold(false); pdf.setTextColor(190, 215, 190)
  pdf.text('Sistema integral de cuidado familiar', M, 29)

  // Report title
  pdf.setFontSize(28); bold(true); pdf.setTextColor(255, 255, 255)
  pdf.text('Reporte Médico', M, 52)
  pdf.setFontSize(9); bold(false); pdf.setTextColor(200, 225, 200)
  pdf.text(`Generado el ${today}`, M, 60)

  y = 82

  // Patient name
  pdf.setFontSize(22); bold(true); pdf.setTextColor(...DK)
  pdf.text(name, M, y); bold(false); y += 9

  // Info row
  const infoParts = []
  if (patient?.fecha_nacimiento) infoParts.push(fmtDate(patient.fecha_nacimiento))
  const ag = calcAge(patient?.fecha_nacimiento)
  if (ag !== null) infoParts.push(`${ag} años`)
  if (patient?.sexo) infoParts.push(patient.sexo === 'masculino' ? 'Masculino' : 'Femenino')
  if (patient?.tipo_sangre) infoParts.push(`Tipo ${patient.tipo_sangre}`)
  if (infoParts.length) {
    pdf.setFontSize(9); pdf.setTextColor(...GR)
    pdf.text(infoParts.join('  ·  '), M, y); y += 6
  }

  // Diagnosis
  if (patient?.diagnostico_principal) {
    y += 1
    pdf.setFontSize(10); pdf.setTextColor(...DK)
    const dlines = pdf.splitTextToSize(`Diagnóstico: ${patient.diagnostico_principal}`, CW)
    pdf.text(dlines, M, y); y += dlines.length * 5 + 2
  }

  // Allergy banner
  if (patient?.alergias_detalle?.length) {
    const names = patient.alergias_detalle.map(a => a.nombre || a).join(', ')
    pdf.setFillColor(255, 240, 240); pdf.rect(M, y, CW, 9, 'F')
    pdf.setFontSize(8.5); bold(true); pdf.setTextColor(...RD)
    pdf.text(`⚠  ALERGIAS: ${names}`, M + 2, y + 5.5); bold(false)
    y += 12
  }

  // Divider + stats
  y += 4
  pdf.setDrawColor(...BD); pdf.line(M, y, W - M, y); y += 6

  pdf.setFontSize(8.5); pdf.setTextColor(...GR)
  const stats = [`${meds.length} medicamento${meds.length !== 1 ? 's' : ''}`]
  if (doctors.length) stats.push(`${doctors.length} médico${doctors.length !== 1 ? 's' : ''}`)
  if (appts.length) stats.push(`${appts.length} cita${appts.length !== 1 ? 's' : ''} próxima${appts.length !== 1 ? 's' : ''}`)
  pdf.text(stats.join('  ·  '), M, y); y += 6

  if (patient?.seguro_compania) {
    pdf.setFontSize(8); pdf.setTextColor(...GR)
    pdf.text(`Seguro: ${patient.seguro_compania}${patient.seguro_poliza ? ` · Póliza: ${patient.seguro_poliza}` : ''}`, M, y)
    y += 6
  }

  footer()

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENIDO
  // ═══════════════════════════════════════════════════════════════════════════
  pdf.addPage(); pageNum++; topStrip()

  // ── Sección 1: Información básica / médica ──────────────────────────────────
  secHeader('Información médica')

  const colL = M, colR = M + CW / 2 + 3

  if (patient?.condiciones_secundarias?.length) {
    kv('Condiciones secundarias', patient.condiciones_secundarias.join(', '))
  }
  if (patient?.indicaciones_medico) {
    checkY(10)
    pdf.setFontSize(8); bold(true); pdf.setTextColor(...GR)
    pdf.text('INDICACIONES ESPECIALES:', M, y); bold(false); y += 4
    txt(patient.indicaciones_medico, 8.5, DK)
  }
  if (patient?.hospital_preferencia) kv('Hospital preferencia', patient.hospital_preferencia)
  if (patient?.movilidad) kv('Movilidad', patient.movilidad)
  if (patient?.estado_cognitivo) kv('Estado cognitivo', patient.estado_cognitivo)
  if (patient?.peso || patient?.talla) {
    const antropo = [patient.peso && `Peso: ${patient.peso} kg`, patient.talla && `Talla: ${patient.talla} cm`].filter(Boolean).join('  ·  ')
    kv('Antropometría', antropo)
  }
  gap(2)

  // ── Sección 2: Medicamentos ──────────────────────────────────────────────────
  if (meds.length) {
    checkY(15); secHeader('Medicamentos actuales')

    const stockMap = {}
    stock.forEach(s => { stockMap[s.medication_id] = s })

    // Header row
    const cols  = [M, M + 55, M + 95, M + 128, M + 160]
    const heads = ['Medicamento', 'Dosis', 'Frecuencia', 'Horario', 'Stock']
    pdf.setFillColor(...GM); pdf.rect(M, y, CW, 7, 'F')
    pdf.setFontSize(8); bold(true); pdf.setTextColor(255, 255, 255)
    heads.forEach((h, i) => pdf.text(h, cols[i] + 1, y + 4.8)); bold(false)
    y += 8

    meds.forEach((med, idx) => {
      checkY(8)
      const s = stockMap[med.id]
      const pills = s?.pills_remaining ?? null
      const low = pills !== null && pills <= 7
      pdf.setFillColor(low ? 255 : (idx % 2 ? 248 : 252), low ? 245 : (idx % 2 ? 248 : 252), low ? 245 : (idx % 2 ? 246 : 252))
      pdf.rect(M, y, CW, 7, 'F')
      const rowColor = low ? RD : DK
      pdf.setFontSize(8); pdf.setTextColor(...rowColor)
      const cells = [
        pdf.splitTextToSize(med.name, 52)[0],
        med.dosage || '—',
        med.frequency || '—',
        (Array.isArray(med.scheduled_times) && med.scheduled_times.length ? med.scheduled_times.join(', ') : med.time) || '—',
        pills !== null ? `${pills}` : '—',
      ]
      cells.forEach((v, i) => pdf.text(String(v ?? '—'), cols[i] + 1, y + 4.8))
      y += 7
    })

    const lowList = meds.filter(m => { const s = stockMap[m.id]; return s?.pills_remaining !== null && s.pills_remaining <= 7 })
    if (lowList.length) {
      y += 2; pdf.setFontSize(8); bold(true); pdf.setTextColor(...RD)
      pdf.text(`⚠  Stock bajo (≤7 dosis): ${lowList.map(m => m.name).join(', ')}`, M, y); bold(false)
      y += 6
    } else { y += 4 }
  }

  // ── Sección 3: Directorio médico ─────────────────────────────────────────────
  if (doctors.length || insts.length || contacts.length) {
    checkY(15); secHeader('Directorio médico')

    const primary = doctors.find(d => d.is_primary)
    const specs   = doctors.filter(d => !d.is_primary)

    if (primary) {
      checkY(5); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('MÉDICO DE CABECERA', M, y); bold(false); y += 4
      contactRow(primary.name, primary.specialty || '', primary.address || primary.clinic || '', primary.cellphone || primary.phone)
    }
    if (specs.length) {
      checkY(5); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('ESPECIALISTAS', M, y); bold(false); y += 4
      specs.forEach(d => contactRow(d.name, d.specialty || '', d.address || d.clinic || '', d.cellphone || d.phone))
    }
    if (insts.length) {
      checkY(5); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('ESTABLECIMIENTOS', M, y); bold(false); y += 4
      insts.forEach(i => contactRow(i.name, i.type || '', i.address || '', i.phone))
    }
    if (contacts.length) {
      checkY(5); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...RD)
      pdf.text('EMERGENCIA', M, y); bold(false); y += 4
      contacts.forEach(c => contactRow(c.name, c.relationship || '', c.address || '', c.phone, true))
    }
    gap(2)
  }

  // ── Sección 4: Notas médicas ──────────────────────────────────────────────────
  if (notes.length) {
    checkY(15); secHeader('Últimas notas médicas')

    notes.slice(0, 5).forEach((note, idx) => {
      checkY(16)
      const d = note.entry_date || note.created_at?.slice(0, 10)
      pdf.setFontSize(9); bold(true); pdf.setTextColor(...G)
      pdf.text(fmtDate(d), M, y); bold(false); y += 5

      if (note.estado_general) {
        pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
        pdf.text('Estado: ', M, y); bold(false); pdf.setTextColor(...DK)
        const ls = pdf.splitTextToSize(note.estado_general, CW - 22)
        pdf.text(ls, M + 20, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (note.que_dijo_el_medico) {
        checkY(7); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
        pdf.text('Médico: ', M, y); bold(false); pdf.setTextColor(...DK)
        const ls = pdf.splitTextToSize(note.que_dijo_el_medico, CW - 22)
        pdf.text(ls, M + 20, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (note.notas) {
        checkY(6); pdf.setFontSize(7.5); pdf.setTextColor(...GR)
        const ls = pdf.splitTextToSize(note.notas, CW)
        pdf.text(ls, M, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (idx < notes.length - 1) {
        pdf.setDrawColor(...BD); pdf.line(M, y + 1, W - M, y + 1); y += 5
      } else { y += 3 }
    })
  }

  // ── Sección 5: Próximas citas ─────────────────────────────────────────────────
  if (appts.length) {
    checkY(15); secHeader('Próximas citas')

    appts.slice(0, 5).forEach(appt => {
      checkY(14)
      pdf.setFillColor(248, 250, 248); pdf.rect(M, y, CW, 11, 'F')
      pdf.setFontSize(9); bold(true); pdf.setTextColor(...G)
      pdf.text(fmtDate(appt.date) + (appt.time ? `  ·  ${appt.time}` : ''), M + 2, y + 4.5); bold(false)
      pdf.setFontSize(8.5); pdf.setTextColor(...DK)
      pdf.text(appt.title || 'Cita médica', M + 2, y + 9)
      if (appt.description) {
        pdf.setFontSize(7.5); pdf.setTextColor(...GR)
        pdf.text(pdf.splitTextToSize(appt.description, 60)[0], W - M - 2, y + 7, { align: 'right' })
      }
      y += 13
    })
  }

  footer()

  // ── Save ───────────────────────────────────────────────────────────────────────
  const safeName  = name.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑüÜ0-9 ]/g, '').replace(/\s+/g, '_')
  const dateStamp = new Date().toISOString().slice(0, 10)
  pdf.save(`Reporte_${safeName}_${dateStamp}.pdf`)
}

// ── Data fetcher (shared by PatientProfile + Dashboard) ───────────────────────
export async function fetchReportData(ownerId) {
  const [
    { data: patient },
    { data: meds },
    { data: stock },
    { data: notes },
    { data: appts },
    { data: doctors },
    { data: insts },
    { data: contacts },
  ] = await Promise.all([
    supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
    supabase.from('medications').select('*').eq('user_id', ownerId),
    supabase.from('medication_stock').select('*').eq('user_id', ownerId),
    supabase.from('medical_diary').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(5),
    supabase.from('events').select('*').eq('user_id', ownerId).gte('date', new Date().toISOString().slice(0, 10)).order('date').limit(5),
    supabase.from('directory_doctors').select('*').eq('owner_id', ownerId).order('is_primary', { ascending: false }),
    supabase.from('directory_institutions').select('*').eq('owner_id', ownerId),
    supabase.from('directory_contacts').select('*').eq('owner_id', ownerId).eq('is_emergency_contact', true),
  ])
  return {
    patient:  patient  ?? {},
    meds:     meds     ?? [],
    stock:    stock    ?? [],
    notes:    notes    ?? [],
    appts:    appts    ?? [],
    doctors:  doctors  ?? [],
    insts:    insts    ?? [],
    contacts: contacts ?? [],
  }
}
