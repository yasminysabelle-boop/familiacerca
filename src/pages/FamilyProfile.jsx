import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function FamilyProfile() {
  const { user } = useAuth()
  const { profile, refresh } = useFamily()
  const fileRef = useRef(null)

  const [form, setForm] = useState({ name: '', age: '', medical_notes: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        age: profile.age ?? '',
        medical_notes: profile.medical_notes ?? '',
      })
      setPhotoPreview(profile.photo_url ?? null)
    }
  }, [profile])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setSaveError('')

    let photo_url = profile?.photo_url ?? null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type })

      if (uploadError) {
        setSaveError('La foto no se pudo subir, pero el perfil se guardará sin ella.')
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(path)
        photo_url = publicUrl
      }
    }

    const { error: upsertError } = await supabase.from('care_profiles').upsert(
      {
        user_id: user.id,
        name: form.name,
        age: form.age ? parseInt(form.age) : null,
        medical_notes: form.medical_notes || null,
        photo_url,
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)

    if (upsertError) {
      setSaveError('Error al guardar el perfil: ' + upsertError.message)
      return
    }

    await refresh()
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Perfil del familiar</h2>
          <p className="text-gray-500 mt-1">Información de la persona que recibe el cuidado</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-green-100 p-5 md:p-8 space-y-6">

          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative group"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto del familiar"
                  className="w-28 h-28 rounded-full object-cover border-4 border-primary-light shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-primary-light border-4 border-primary-light flex items-center justify-center text-5xl shadow-sm">
                  👴
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">Cambiar</span>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <p className="text-xs text-gray-400">Haz clic en la foto para cambiarla</p>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="ej. Abuela Rosa García"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
              <input
                name="age"
                type="number"
                min="1"
                max="120"
                value={form.age}
                onChange={handleChange}
                placeholder="78"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas médicas importantes
            </label>
            <textarea
              name="medical_notes"
              value={form.medical_notes}
              onChange={handleChange}
              rows={5}
              placeholder="Condiciones médicas, alergias, medicamentos actuales, instrucciones especiales del médico..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {saveError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ {saveError}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 bg-primary-light border border-green-200 rounded-lg text-sm text-primary font-medium">
              ✓ Perfil guardado correctamente
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
