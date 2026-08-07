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

// Reintenta fn() ante blips de red transitorios — nunca ante errores de
// permiso (RLS = código Postgres 42501), esos deben fallar rápido y
// mostrarse, no reintentarse a ciegas.
async function withRetry(fn, delays = [300, 800]) {
  for (let i = 0; ; i++) {
    try { return await fn() }
    catch (e) {
      if (i >= delays.length || e.code === '42501') throw e
      await new Promise(r => setTimeout(r, delays[i]))
    }
  }
}

// Sube la foto del paciente y actualiza patient_profiles.photo_url +
// care_profiles.photo_url (FamilySwitcher/Settings/Familia leen de ahí,
// no de patient_profiles) en una sola transacción vía RPC — antes eran dos
// escrituras separadas que podían quedar a mitad de camino si la segunda
// fallaba (ver hallazgo 2026-08: RLS bloqueaba a los cuidadores en la
// segunda escritura, dejando patient_profiles y care_profiles divergentes
// permanentemente). Borra la foto anterior del bucket una vez confirmado
// el éxito, y avisa al resto de la app vía patientProfileUpdated (con la
// URL nueva en el detail, para que los listeners se actualicen sin
// necesidad de un refetch).
export async function uploadPatientPhoto(ownerId, file) {
  const row = await ensurePatientProfileRow(ownerId)

  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `${row.id}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  await withRetry(async () => {
    const { error } = await supabase.rpc('update_patient_photo', {
      p_owner_id: ownerId,
      p_photo_url: publicUrl,
    })
    if (error) throw error
  })

  const oldPath = extractStoragePath(row.photo_url)
  if (oldPath && oldPath !== path) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([oldPath])
    if (removeErr) console.error('[patientPhoto] no se pudo borrar la foto anterior:', removeErr)
  }

  window.dispatchEvent(new CustomEvent('patientProfileUpdated', { detail: { ownerId, photoUrl: publicUrl } }))

  return { photoUrl: publicUrl }
}
