import { supabase } from './supabase'

const BUCKET = 'patient-photos'

async function ensurePatientProfileRow(ownerId) {
  const { data: row } = await supabase
    .from('patient_profiles')
    .select('id, photo_url')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (row) return row

  const { data: created, error } = await supabase
    .from('patient_profiles')
    .insert({ owner_id: ownerId })
    .select('id, photo_url')
    .single()
  if (error) throw error
  return created
}

function extractStoragePath(publicUrl) {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = publicUrl?.indexOf(marker) ?? -1
  return idx === -1 ? null : publicUrl.slice(idx + marker.length)
}

// Sube la foto del paciente, actualiza patient_profiles.photo_url y
// care_profiles.photo_url (FamilySwitcher/Settings/Familia leen de ahí,
// no de patient_profiles), borra la foto anterior del bucket una vez
// confirmado el éxito, y avisa al resto de la app vía patientProfileUpdated.
export async function uploadPatientPhoto(ownerId, file) {
  const row = await ensurePatientProfileRow(ownerId)

  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `${row.id}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: patientErr } = await supabase
    .from('patient_profiles')
    .update({ photo_url: publicUrl })
    .eq('id', row.id)
  if (patientErr) throw patientErr

  const { error: careErr } = await supabase
    .from('care_profiles')
    .upsert({ user_id: ownerId, photo_url: publicUrl }, { onConflict: 'user_id' })
  if (careErr) throw careErr

  const oldPath = extractStoragePath(row.photo_url)
  if (oldPath && oldPath !== path) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([oldPath])
    if (removeErr) console.error('[patientPhoto] no se pudo borrar la foto anterior:', removeErr)
  }

  window.dispatchEvent(new CustomEvent('patientProfileUpdated'))

  return { photoUrl: publicUrl }
}
