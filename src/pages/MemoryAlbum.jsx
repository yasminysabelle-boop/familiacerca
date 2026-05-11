import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const REACTIONS = ['❤️', '😊', '🙏', '💪', '😢']

export default function MemoryAlbum() {
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [viewing, setViewing] = useState(null)
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => { if (user) fetchMemories() }, [user])

  async function fetchMemories() {
    setLoading(true)
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
    setMemories(data ?? [])
    setLoading(false)
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]; if (!f) return
    setSelectedFile(f); setPreview(URL.createObjectURL(f))
  }

  async function handleUpload(e) {
    e.preventDefault(); if (!selectedFile) return
    setUploading(true)
    setUploadError('')
    const isVideo = selectedFile.type.startsWith('video/')
    const ext = selectedFile.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('memories')
      .upload(path, selectedFile, { contentType: selectedFile.type })

    if (storageError) {
      setUploadError('Error al subir el archivo: ' + storageError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(path)

    const { error: insertError } = await supabase.from('memories').insert({
      user_id: user.id,
      uploader_name: displayName,
      file_url: publicUrl,
      file_type: isVideo ? 'video' : 'image',
      caption: caption.trim() || null,
      reactions: {},
    })

    if (insertError) {
      setUploadError('El archivo se subió pero no se pudo guardar: ' + insertError.message)
      setUploading(false)
      return
    }

    setSelectedFile(null); setPreview(null); setCaption('')
    setUploading(false); fetchMemories()
  }

  async function addReaction(memory, emoji) {
    const current = memory.reactions ?? {}
    const users = current[emoji] ?? []
    const updated = { ...current, [emoji]: users.includes(user.id) ? users.filter(id => id !== user.id) : [...users, user.id] }
    await supabase.from('memories').update({ reactions: updated }).eq('id', memory.id)
    setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, reactions: updated } : m))
    if (viewing?.id === memory.id) setViewing(v => ({ ...v, reactions: updated }))
  }

  async function deleteMemory(id) {
    await supabase.from('memories').delete().eq('id', id)
    setMemories(prev => prev.filter(m => m.id !== id))
    setViewing(null)
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Álbum familiar</h2>
          <p className="text-gray-500 mt-1">Fotos y videos de momentos especiales en familia</p>
        </div>

        {/* Upload */}
        <form onSubmit={handleUpload} className="bg-white rounded-xl border border-green-100 p-5 mb-8">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-green-200 rounded-xl overflow-hidden hover:border-primary transition-colors mb-3">
            {preview ? (
              selectedFile?.type.startsWith('video/') ? (
                <video src={preview} className="w-full max-h-56 object-cover" />
              ) : (
                <img src={preview} className="w-full max-h-56 object-cover" alt="Vista previa" />
              )
            ) : (
              <div className="h-28 flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 transition-colors">
                <span className="text-3xl">🖼️</span>
                <p className="text-sm font-medium">Agregar foto o video al álbum</p>
              </div>
            )}
          </button>
          {selectedFile && (
            <div className="flex gap-3">
              <input value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Escribe un pie de foto (opcional)..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <button type="submit" disabled={uploading}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                {uploading ? 'Subiendo...' : '+ Publicar'}
              </button>
            </div>
          )}
        </form>

        {uploadError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            ⚠ {uploadError}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : memories.length === 0 ? (
          <div className="bg-white rounded-xl border border-green-100 p-14 text-center">
            <p className="text-5xl mb-3">🖼️</p>
            <p className="text-gray-500 text-sm">El álbum está vacío. ¡Agrega el primer recuerdo!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {memories.map(memory => (
              <div key={memory.id} className="bg-white rounded-xl border border-green-100 overflow-hidden">
                <button onClick={() => setViewing(memory)} className="w-full aspect-square overflow-hidden block group">
                  {memory.file_type === 'video' ? (
                    <video src={memory.file_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <img src={memory.file_url} alt={memory.caption ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                </button>
                <div className="p-3">
                  {memory.caption && <p className="text-xs text-gray-700 mb-2 leading-snug">{memory.caption}</p>}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-0.5">
                      {REACTIONS.map(emoji => {
                        const count = memory.reactions?.[emoji]?.length ?? 0
                        const reacted = memory.reactions?.[emoji]?.includes(user.id)
                        return (
                          <button key={emoji} onClick={() => addReaction(memory, emoji)}
                            className={`text-sm px-1 py-0.5 rounded-md transition-colors ${reacted ? 'bg-primary-light' : 'hover:bg-gray-100'}`}>
                            {emoji}{count > 0 && <span className="text-xs ml-0.5 text-gray-600">{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(memory.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full view lightbox */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {viewing.file_type === 'video' ? (
              <video src={viewing.file_url} controls autoPlay className="w-full rounded-2xl max-h-[65vh] object-contain" />
            ) : (
              <img src={viewing.file_url} alt={viewing.caption ?? ''} className="w-full rounded-2xl max-h-[65vh] object-contain" />
            )}
            {viewing.caption && <p className="text-white text-center mt-3 text-sm font-medium">{viewing.caption}</p>}
            <p className="text-gray-400 text-center text-xs mt-1">Publicado por {viewing.uploader_name}</p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {REACTIONS.map(emoji => {
                const count = viewing.reactions?.[emoji]?.length ?? 0
                return (
                  <button key={emoji} onClick={() => addReaction(viewing, emoji)}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                      viewing.reactions?.[emoji]?.includes(user.id) ? 'bg-primary text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}>
                    {emoji} {count > 0 && <span>{count}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setViewing(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
                Cerrar
              </button>
              {viewing.user_id === user.id && (
                <button onClick={() => deleteMemory(viewing.id)}
                  className="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
