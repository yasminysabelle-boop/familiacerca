import { supabase } from '../lib/supabase'

// Reemplaza los 5 generadores de PDF que existian en el proyecto
// (Reports.jsx x2, generateMedicalReport.js via PatientProfile.jsx,
// AdminDataSection.jsx, y el handlePDF muerto de Dashboard.jsx). Ver
// project_familiacerca_reports_audit en memoria para el detalle de la
// auditoria que motivo esta unificacion.
//
// Regla dura, igual que las reglas de Milo (ver CONTEXT_RULES en
// careContext.js): este modulo nunca infiere, evalua ni usa lenguaje de
// severidad. Solo reporta lo que la app sabe con certeza -- conteos,
// fechas, contenido tal cual esta en la base. El panel "Analisis de
// bienestar" que tenia Reports.jsx (deteccion de palabras de alerta con
// frases como "-- Considera una consulta medica") NUNCA paso al PDF y
// sigue sin pasar aca a proposito.

export const SECTIONS = {
  COVER: 'cover',
  MEDICATIONS: 'medications',
  ADHERENCE: 'adherence',
  MEDICATION_LOG: 'medicationLog',
  FAMILY_NOTES: 'familyNotes',
  MEDICAL_DIARY: 'medicalDiary',
  PAST_EVENTS: 'pastEvents',
  UPCOMING_APPOINTMENTS: 'upcomingAppointments',
  VOICE_MEMORIES: 'voiceMemories',
  DIRECTORY: 'directory',
  EXPENSES: 'expenses',
}

// ── Paleta real de la app (antes varios generadores tenian comentarios de
// color que no coincidian con el valor RGB real -- ver hallazgo en
// project_familiacerca_reports_audit) ──────────────────────────────────────
const TEAL  = [8, 127, 112]   // #087F70
const CREMA = [248, 244, 237] // #F8F4ED
const CORAL = [233, 130, 110] // #E9826E -- mismo uso que CORAL_ACTION en
                               // MedicationTimeline.jsx: acento de alerta/
                               // urgencia, no un rojo generico
const DK = [26, 26, 26]
const GR = [107, 114, 128]

// Tipografia: Helvetica nativa de jsPDF, decision explicita de Yasmin --
// el PDF termina impreso o en manos de un medico, importa que se lea bien
// mas que la fidelidad de marca, y embeber Plus Jakarta Sans suma peso a
// una app de uso movil con conexion mala. Mejora futura si hace falta
// fidelidad exacta: `doc.addFont()` con el .ttf real, cargado solo cuando
// se genera el PDF (mismo patron de import dinamico de abajo).

function since(days) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function sinceIso(days) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString()
}
function todayStr() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtDate(s) {
  if (!s) return ''
  try { return new Date((s + '').slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return s }
}
function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob + 'T12:00:00'), t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--
  return a
}

// ── Data fetching -- solo trae lo que las secciones pedidas necesitan ──────
export async function fetchPdfReportData(ownerId, { sections, windowDays = 30 }) {
  const has = s => sections.includes(s)
  const today = new Date().toISOString().slice(0, 10)

  const queries = {}
  if (has(SECTIONS.COVER) || has(SECTIONS.MEDICATIONS)) {
    queries.patient = supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle()
  }
  if (has(SECTIONS.MEDICATIONS)) {
    queries.meds = supabase.from('medications').select('*').eq('user_id', ownerId).order('name')
    queries.stock = supabase.from('medication_stock').select('*').eq('user_id', ownerId)
  }
  if (has(SECTIONS.ADHERENCE) || has(SECTIONS.MEDICATION_LOG)) {
    queries.logs = supabase.from('medication_logs')
      .select('*, medications(name, dosage)')
      .eq('user_id', ownerId)
      .gte('log_date', since(windowDays))
      .order('log_date', { ascending: false })
  }
  if (has(SECTIONS.FAMILY_NOTES)) {
    queries.familyNotes = supabase.from('notes')
      .select('*').eq('user_id', ownerId)
      .gte('created_at', sinceIso(windowDays))
      .order('created_at', { ascending: false })
  }
  if (has(SECTIONS.MEDICAL_DIARY)) {
    queries.medicalDiary = supabase.from('medical_diary')
      .select('*').eq('owner_id', ownerId)
      .gte('created_at', sinceIso(windowDays))
      .order('created_at', { ascending: false })
  }
  if (has(SECTIONS.PAST_EVENTS)) {
    queries.pastEvents = supabase.from('events')
      .select('*').eq('user_id', ownerId)
      .gte('date', since(windowDays)).lt('date', today)
      .order('date', { ascending: false })
  }
  if (has(SECTIONS.UPCOMING_APPOINTMENTS)) {
    queries.upcomingAppointments = supabase.from('events')
      .select('*').eq('user_id', ownerId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(5)
  }
  if (has(SECTIONS.VOICE_MEMORIES)) {
    queries.voiceMemories = supabase.from('voice_diary')
      .select('*').eq('user_id', ownerId)
      .gte('created_at', sinceIso(windowDays))
      .order('created_at', { ascending: false })
  }
  if (has(SECTIONS.DIRECTORY)) {
    // directory_doctors/directory_institutions ya no existen -- se
    // fusionaron en directory_contacts con un campo `kind` (ver
    // project_familiacerca_reports_audit). Los contactos de emergencia
    // (kind='familiar') ya apuntaban aca desde siempre.
    queries.doctors = supabase.from('directory_contacts')
      .select('*').eq('owner_id', ownerId).eq('kind', 'medico')
      .order('is_primary', { ascending: false })
    queries.institutions = supabase.from('directory_contacts')
      .select('*').eq('owner_id', ownerId).eq('kind', 'institucion')
    queries.emergencyContacts = supabase.from('directory_contacts')
      .select('*').eq('owner_id', ownerId).eq('kind', 'familiar').eq('is_emergency_contact', true)
  }
  if (has(SECTIONS.EXPENSES)) {
    queries.expenses = supabase.from('care_expenses')
      .select('*').eq('user_id', ownerId)
      .gte('date', since(windowDays))
      .order('date', { ascending: false })
  }

  const keys = Object.keys(queries)
  const results = await Promise.all(keys.map(k => queries[k]))
  const out = {}
  keys.forEach((k, i) => { out[k] = results[i].data ?? (k === 'patient' ? null : []) })
  return out
}

// ── PDF builder ──────────────────────────────────────────────────────────
export async function generatePdfReport(data, { sections, windowDays = 30, patientName }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const has = s => sections.includes(s)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 15, CW = W - 2 * M
  const patient = data.patient ?? {}
  const name = patient?.nombre_completo || patientName || 'Paciente'
  const today = todayStr()
  let pageNum = 1
  let y = M

  function footer() {
    pdf.setFontSize(7); pdf.setTextColor(...GR)
    pdf.text(`Generado por FamiliaCerca · familiacerca.com · ${today}`, M, H - 8)
    pdf.text(`Pág. ${pageNum}`, W - M, H - 8, { align: 'right' })
  }
  function topStrip() {
    pdf.setFillColor(...TEAL); pdf.rect(0, 0, W, 9, 'F')
    pdf.setFontSize(7); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255)
    pdf.text('FamiliaCerca', M, 6)
    pdf.setFont(undefined, 'normal')
    pdf.text(name, W - M, 6, { align: 'right' })
    y = 16
  }
  function newPage() { footer(); pdf.addPage(); pageNum++; topStrip() }
  function checkY(need) { if (y + need > H - 18) newPage() }
  function bold(on) { pdf.setFont(undefined, on ? 'bold' : 'normal') }
  function gap(h = 4) { y += h }

  function secHeader(title) {
    checkY(12)
    pdf.setFillColor(...TEAL); pdf.rect(M, y, CW, 8, 'F')
    pdf.setFontSize(10); bold(true); pdf.setTextColor(255, 255, 255)
    pdf.text(title, M + 3, y + 5.5); bold(false)
    y += 11
  }
  function txt(text, size, color, x, w) {
    if (!text) return
    pdf.setFontSize(size); pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(String(text), w ?? CW)
    checkY(lines.length * (size * 0.4))
    pdf.text(lines, x ?? M, y)
    y += lines.length * (size * 0.42) + 1
  }
  function kv(label, value, maxW = CW - 5) {
    if (!value) return
    checkY(8)
    pdf.setFontSize(8); bold(true); pdf.setTextColor(...GR)
    const labelText = label.toUpperCase() + ':'
    pdf.text(labelText, M, y)
    // Posicion del valor calculada por el ancho real de la etiqueta, no un
    // offset fijo -- con offset fijo, etiquetas largas ("CONDICIONES
    // SECUNDARIAS:") quedan tapadas por el valor en vez de dejarle lugar.
    const labelW = pdf.getTextWidth(labelText)
    bold(false); pdf.setTextColor(...DK)
    const valueX = M + labelW + 3
    const lines = pdf.splitTextToSize(String(value), Math.max(maxW - labelW - 3, 30))
    pdf.text(lines, valueX, y)
    y += Math.max(lines.length * 4, 5)
  }
  function contactRow(nm, sub1, sub2, phone, alert = false) {
    checkY(13)
    pdf.setFillColor(...CREMA); pdf.rect(M, y, CW, 11, 'F')
    pdf.setFontSize(9.5); bold(true)
    pdf.setTextColor(...(alert ? CORAL : TEAL))
    pdf.text(nm, M + 2, y + 5); bold(false)
    pdf.setFontSize(7.5); pdf.setTextColor(...GR)
    if (sub1) pdf.text(sub1, M + 2, y + 9)
    if (sub2) pdf.text(sub2, M + CW / 2, y + 9)
    if (phone) {
      pdf.setFontSize(8)
      pdf.setTextColor(...(alert ? CORAL : TEAL))
      pdf.text(`Tel: ${phone}`, W - M - 2, y + 5, { align: 'right' })
    }
    y += 13
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PORTADA -- solo si se pide SECTIONS.COVER
  // ═══════════════════════════════════════════════════════════════════════
  if (has(SECTIONS.COVER)) {
    pdf.setFillColor(...TEAL); pdf.rect(0, 0, W, 72, 'F')
    pdf.setFontSize(14); bold(true); pdf.setTextColor(255, 255, 255)
    pdf.text('FamiliaCerca', M, 22)
    pdf.setFontSize(9); bold(false); pdf.setTextColor(220, 235, 233)
    pdf.text('Sistema integral de cuidado familiar', M, 29)
    pdf.setFontSize(28); bold(true); pdf.setTextColor(255, 255, 255)
    pdf.text('Reporte de Cuidado', M, 52)
    pdf.setFontSize(9); bold(false); pdf.setTextColor(220, 235, 233)
    pdf.text(`Generado el ${today}`, M, 60)

    y = 82
    pdf.setFontSize(22); bold(true); pdf.setTextColor(...DK)
    pdf.text(name, M, y); bold(false); y += 9

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

    if (patient?.diagnostico_principal) {
      y += 1
      pdf.setFontSize(10); pdf.setTextColor(...DK)
      const dlines = pdf.splitTextToSize(`Diagnóstico: ${patient.diagnostico_principal}`, CW)
      pdf.text(dlines, M, y); y += dlines.length * 5 + 2
    }

    if (patient?.alergias_detalle?.length) {
      const names = patient.alergias_detalle.map(a => a.nombre || a).join(', ')
      pdf.setFillColor(...CREMA); pdf.rect(M, y, CW, 9, 'F')
      pdf.setFontSize(8.5); bold(true); pdf.setTextColor(...CORAL)
      pdf.text(`ALERGIAS: ${names}`, M + 2, y + 5.5); bold(false)
      y += 12
    }

    if (patient?.seguro_compania) {
      pdf.setFontSize(8); pdf.setTextColor(...GR)
      pdf.text(`Seguro: ${patient.seguro_compania}${patient.seguro_poliza ? ` · Póliza: ${patient.seguro_poliza}` : ''}`, M, y)
      y += 6
    }

    footer()
    pdf.addPage(); pageNum++; topStrip()
  } else {
    topStrip()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Informacion medica adicional del perfil (junto con medicamentos, si se pide)
  // ═══════════════════════════════════════════════════════════════════════
  if (has(SECTIONS.MEDICATIONS) && (patient?.condiciones_secundarias?.length || patient?.indicaciones_medico
    || patient?.hospital_preferencia || patient?.movilidad || patient?.estado_cognitivo || patient?.peso || patient?.talla)) {
    secHeader('Información médica')
    if (patient?.condiciones_secundarias?.length) kv('Condiciones secundarias', patient.condiciones_secundarias.join(', '))
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
  }

  // ── Medicamentos actuales, con stock bajo resaltado ─────────────────────
  if (has(SECTIONS.MEDICATIONS) && data.meds?.length) {
    checkY(15); secHeader('Medicamentos actuales')
    const stockMap = {}
    ;(data.stock ?? []).forEach(s => { stockMap[s.medication_id] = s })

    const cols = [M, M + 55, M + 95, M + 128, M + 160]
    const heads = ['Medicamento', 'Dosis', 'Frecuencia', 'Horario', 'Stock']
    pdf.setFillColor(...TEAL); pdf.rect(M, y, CW, 7, 'F')
    pdf.setFontSize(8); bold(true); pdf.setTextColor(255, 255, 255)
    heads.forEach((h, i) => pdf.text(h, cols[i] + 1, y + 4.8)); bold(false)
    y += 8

    data.meds.forEach((med, idx) => {
      checkY(8)
      const s = stockMap[med.id]
      const pills = s?.pills_remaining ?? null
      const low = pills !== null && pills <= 7
      pdf.setFillColor(...(low ? [253, 240, 236] : (idx % 2 ? CREMA : [255, 255, 255])))
      pdf.rect(M, y, CW, 7, 'F')
      pdf.setFontSize(8); pdf.setTextColor(...(low ? CORAL : DK))
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

    const lowList = data.meds.filter(m => { const s = stockMap[m.id]; return s?.pills_remaining !== null && s?.pills_remaining !== undefined && s.pills_remaining <= 7 })
    if (lowList.length) {
      y += 2; pdf.setFontSize(8); bold(true); pdf.setTextColor(...CORAL)
      pdf.text(`Stock bajo (7 dosis o menos): ${lowList.map(m => m.name).join(', ')}`, M, y); bold(false)
      y += 6
    } else { y += 4 }
  }

  // ── Adherencia -- agregado, ventana visible en el titulo ────────────────
  if (has(SECTIONS.ADHERENCE)) {
    const logs = data.logs ?? []
    const confirmed = logs.filter(l => l.status === 'confirmed').length
    const missed = logs.filter(l => l.status === 'missed').length
    const pct = logs.length ? Math.round((confirmed / logs.length) * 100) : null
    checkY(15); secHeader(`Adherencia a medicamentos — últimos ${windowDays} días`)
    pdf.setFontSize(9); pdf.setTextColor(...DK)
    pdf.text(
      pct === null
        ? 'Sin registros de confirmación en este período.'
        : `${confirmed} dosis confirmadas · ${missed} perdidas · Adherencia: ${pct}%`,
      M, y,
    )
    y += 9
  }

  // ── Registro de medicamentos -- tabla cruda con todos los estados ───────
  if (has(SECTIONS.MEDICATION_LOG) && data.logs?.length) {
    checkY(15); secHeader(`Registro de medicamentos — últimos ${windowDays} días`)
    autoTable(pdf, {
      startY: y,
      head: [['Fecha', 'Medicamento', 'Estado', 'Confirmado por', 'Hora']],
      body: data.logs.map(l => [
        l.log_date,
        l.medications?.name ?? '—',
        l.status === 'confirmed' ? 'Confirmado' : l.status === 'missed' ? 'No dado' : 'Pendiente',
        l.confirmed_by_name ?? '—',
        l.confirmed_at ? new Date(l.confirmed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: TEAL, fontSize: 8 },
      alternateRowStyles: { fillColor: CREMA },
      margin: { left: M, right: M },
    })
    y = pdf.lastAutoTable.finalY + 8
  }

  // ── Notas de familia ─────────────────────────────────────────────────────
  if (has(SECTIONS.FAMILY_NOTES) && data.familyNotes?.length) {
    checkY(15); secHeader(`Notas de familia — últimos ${windowDays} días`)
    autoTable(pdf, {
      startY: y,
      head: [['Fecha', 'Título', 'Contenido']],
      body: data.familyNotes.map(n => [
        new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        n.title ?? '—',
        (n.content ?? '').length > 90 ? n.content.slice(0, 90) + '…' : (n.content ?? '—'),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: TEAL, fontSize: 8 },
      alternateRowStyles: { fillColor: CREMA },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 42 } },
      margin: { left: M, right: M },
    })
    y = pdf.lastAutoTable.finalY + 8
  }

  // ── Diario medico -- tabla distinta de notas de familia, fuente distinta ─
  if (has(SECTIONS.MEDICAL_DIARY) && data.medicalDiary?.length) {
    checkY(15); secHeader(`Diario médico — últimos ${windowDays} días`)
    data.medicalDiary.slice(0, 10).forEach((entry, idx) => {
      checkY(16)
      const d = entry.entry_date || entry.created_at?.slice(0, 10)
      pdf.setFontSize(9); bold(true); pdf.setTextColor(...TEAL)
      pdf.text(fmtDate(d), M, y); bold(false); y += 5
      if (entry.estado_general) {
        pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
        pdf.text('Estado: ', M, y); bold(false); pdf.setTextColor(...DK)
        const ls = pdf.splitTextToSize(entry.estado_general, CW - 22)
        pdf.text(ls, M + 20, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (entry.que_dijo_el_medico) {
        checkY(7); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
        pdf.text('Médico: ', M, y); bold(false); pdf.setTextColor(...DK)
        const ls = pdf.splitTextToSize(entry.que_dijo_el_medico, CW - 22)
        pdf.text(ls, M + 20, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (entry.notas) {
        checkY(6); pdf.setFontSize(7.5); pdf.setTextColor(...GR)
        const ls = pdf.splitTextToSize(entry.notas, CW)
        pdf.text(ls, M, y); y += Math.max(ls.length * 4, 4) + 1
      }
      if (idx < data.medicalDiary.slice(0, 10).length - 1) {
        pdf.setDrawColor(230, 225, 216); pdf.line(M, y + 1, W - M, y + 1); y += 5
      } else { y += 3 }
    })
  }

  // ── Historial de eventos pasados ─────────────────────────────────────────
  if (has(SECTIONS.PAST_EVENTS) && data.pastEvents?.length) {
    checkY(15); secHeader(`Historial de eventos — últimos ${windowDays} días`)
    autoTable(pdf, {
      startY: y,
      head: [['Fecha', 'Evento', 'Tipo', 'Hora']],
      body: data.pastEvents.map(e => [
        e.date, e.title ?? '—',
        e.type === 'appointment' ? 'Cita médica' : e.type === 'therapy' ? 'Terapia' : e.type === 'medication' ? 'Medicamento' : 'Otro',
        e.time ?? '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: TEAL, fontSize: 8 },
      alternateRowStyles: { fillColor: CREMA },
      margin: { left: M, right: M },
    })
    y = pdf.lastAutoTable.finalY + 8
  }

  // ── Directorio medico -- formato de contacto, con stock bajo/emergencia resaltados en coral ─
  if (has(SECTIONS.DIRECTORY) && (data.doctors?.length || data.institutions?.length || data.emergencyContacts?.length)) {
    checkY(15); secHeader('Directorio médico')
    const primary = (data.doctors ?? []).find(d => d.is_primary)
    const specs = (data.doctors ?? []).filter(d => !d.is_primary)

    if (primary) {
      checkY(5); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('MÉDICO DE CABECERA', M, y); bold(false); y += 4
      contactRow(primary.name, primary.specialty || '', primary.address || primary.clinic || '', primary.cellphone || primary.phone)
    }
    if (specs.length) {
      // +3 de aire extra entre el bloque anterior y esta etiqueta -- sin
      // esto, el label queda pegado a la fila de contacto de arriba.
      if (primary) y += 3
      checkY(8); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('ESPECIALISTAS', M, y); bold(false); y += 4
      specs.forEach(d => contactRow(d.name, d.specialty || '', d.address || d.clinic || '', d.cellphone || d.phone))
    }
    if (data.institutions?.length) {
      if (primary || specs.length) y += 3
      checkY(8); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...GR)
      pdf.text('ESTABLECIMIENTOS', M, y); bold(false); y += 4
      data.institutions.forEach(i => contactRow(i.name, i.type || '', i.address || '', i.phone))
    }
    if (data.emergencyContacts?.length) {
      if (primary || specs.length || data.institutions?.length) y += 3
      checkY(8); pdf.setFontSize(7.5); bold(true); pdf.setTextColor(...CORAL)
      pdf.text('EMERGENCIA', M, y); bold(false); y += 4
      data.emergencyContacts.forEach(c => contactRow(c.name, c.relationship || '', c.address || '', c.phone, true))
    }
    gap(2)
  }

  // ── Proximas citas -- hacia adelante, no usa windowDays ──────────────────
  if (has(SECTIONS.UPCOMING_APPOINTMENTS) && data.upcomingAppointments?.length) {
    checkY(15); secHeader('Próximas citas')
    data.upcomingAppointments.forEach(appt => {
      checkY(14)
      pdf.setFillColor(...CREMA); pdf.rect(M, y, CW, 11, 'F')
      pdf.setFontSize(9); bold(true); pdf.setTextColor(...TEAL)
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

  // ── Memorias de voz ───────────────────────────────────────────────────────
  if (has(SECTIONS.VOICE_MEMORIES) && data.voiceMemories?.length) {
    checkY(15); secHeader(`Memorias de voz — últimos ${windowDays} días`)
    autoTable(pdf, {
      startY: y,
      head: [['Fecha', 'Transcripción']],
      body: data.voiceMemories.map(m => [
        m.created_at?.slice(0, 10) ?? '—',
        (m.transcription ?? '').length > 100 ? m.transcription.slice(0, 100) + '…' : (m.transcription ?? '—'),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: TEAL, fontSize: 8 },
      alternateRowStyles: { fillColor: CREMA },
      columnStyles: { 1: { cellWidth: 120 } },
      margin: { left: M, right: M },
    })
    y = pdf.lastAutoTable.finalY + 8
  }

  // ── Gastos de cuidado ────────────────────────────────────────────────────
  if (has(SECTIONS.EXPENSES) && data.expenses?.length) {
    checkY(15); secHeader(`Gastos de cuidado — últimos ${windowDays} días`)
    const total = data.expenses.reduce((s, e) => s + Number(e.amount), 0)
    autoTable(pdf, {
      startY: y,
      head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Pagado por']],
      body: [
        ...data.expenses.map(e => [
          e.date, e.category, e.description ?? '—',
          `$${Number(e.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          e.paid_by ?? '—',
        ]),
        ['', '', 'TOTAL', `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, ''],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: TEAL, fontSize: 8 },
      alternateRowStyles: { fillColor: CREMA },
      margin: { left: M, right: M },
    })
  }

  footer()
  const safeName = name.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑüÜ0-9 ]/g, '').replace(/\s+/g, '_')
  const dateStamp = new Date().toISOString().slice(0, 10)
  pdf.save(`Reporte_${safeName}_${dateStamp}.pdf`)
}
