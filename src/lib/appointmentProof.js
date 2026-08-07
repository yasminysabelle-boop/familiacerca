import { supabase } from './supabase'

const BUCKET = 'appointment-proofs'

// Marca una cita como asistida — foto y/o nota, un solo UPDATE sobre events
// (ya no hay tabla appointment_proofs separada, ver
// supabase/merge_appointment_proofs_into_events.sql). Path único por subida
// de foto (mismo criterio que patientPhoto.js) para no depender de
// upsert/caché de storage.
export async function submitAppointmentProof(eventId, userId, { file, notes } = {}) {
  let photoUrl = null
  if (file) {
    const ext  = file.name?.split('.').pop() || 'jpg'
    const path = `${userId}/${eventId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg' })
    if (upErr) throw upErr
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    photoUrl = publicUrl
  }

  const update = { attended: true, proof_created_by: userId }
  if (photoUrl) update.proof_photo_url = photoUrl
  if (notes) update.proof_notes = notes

  const { error } = await supabase.from('events').update(update).eq('id', eventId)
  if (error) throw error

  return { photoUrl }
}
