import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const emptyForm = { name: '', dosage: '', frequency: '', time: '', notes: '' }

export default function Medications() {
  const { user } = useAuth()
  const [medications, setMedications] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) fetchMedications()
  }, [user])

  async function fetchMedications() {
    setLoading(true)
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMedications(data ?? [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      time: form.time || null,
      user_id: user.id,
    }
    await supabase.from('medications').insert(payload)
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    fetchMedications()
  }

  async function handleDelete(id) {
    await supabase.from('medications').delete().eq('id', id)
    setMedications(prev => prev.filter(m => m.id !== id))
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Medicamentos</h2>
            <p className="text-gray-500 mt-1">Registro de medicamentos del familiar</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Agregar
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-green-100 p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Nuevo medicamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input name="name" required value={form.name} onChange={handleChange}
                  placeholder="ej. Metformina"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosis</label>
                <input name="dosage" value={form.dosage} onChange={handleChange}
                  placeholder="ej. 500mg"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                <input name="frequency" value={form.frequency} onChange={handleChange}
                  placeholder="ej. Dos veces al día"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" name="time" value={form.time} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                placeholder="Instrucciones especiales, efectos secundarios, etc."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : medications.length === 0 ? (
          <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
            <p className="text-4xl mb-3">💊</p>
            <p className="text-gray-500 text-sm">No hay medicamentos registrados aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {medications.map(med => (
              <div key={med.id} className="bg-white rounded-xl border border-green-100 p-5 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-xl flex-shrink-0">
                    💊
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{med.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {med.dosage && <span className="text-xs text-gray-500">{med.dosage}</span>}
                      {med.frequency && <span className="text-xs text-gray-500">{med.frequency}</span>}
                      {med.time && <span className="text-xs text-gray-500">⏰ {med.time}</span>}
                    </div>
                    {med.notes && <p className="text-xs text-gray-400 mt-1">{med.notes}</p>}
                  </div>
                </div>
                <button onClick={() => handleDelete(med.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 ml-4 flex-shrink-0">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
