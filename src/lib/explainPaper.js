import { supabase } from './supabase'

// Milo explica papeles (nov 2026): una foto de una carta del médico, del
// seguro, una factura o un resultado — casi siempre en inglés — y Milo la
// cuenta en español sencillo. No da consejo médico: solo explica qué dice el
// papel y qué hay que hacer. Usa gemini-vision con el cupo de 'diario'
// (rate limit server-side ya existente).

const GEMINI_VISION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-vision`
const MAX_DIMENSION = 2048

function compress(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(file)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => resolve(file)
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
        width = Math.round(width * scale); height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.85)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

const PROMPT = `Eres un ayudante para familias latinas que cuidan a un familiar mayor. Te muestran la foto de un papel (puede estar en inglés o en español): carta del médico, del seguro (Medicare, Medicaid, aseguradora), factura, resultado, cita, receta o aviso.

Explícalo en español sencillo, como a alguien que no habla inglés ni conoce términos médicos. NO des consejo médico, NO interpretes si un resultado es bueno o malo: solo di qué dice el papel y qué hay que hacer. Si algo no se lee, dilo.

Responde SOLO con este JSON:
{
  "legible": true,
  "tipo": "qué es este papel, en pocas palabras (ej: 'Factura del hospital', 'Carta del seguro: negaron un pago')",
  "de_quien": "quién lo manda, si se ve",
  "resumen": "2 o 3 frases cortas: qué dice",
  "hay_que_hacer": ["acciones concretas, si hay (ej: 'Llamar al seguro antes del 15 de diciembre')"],
  "fechas": ["fechas importantes con qué pasa ese día"],
  "dinero": "cuánto hay que pagar y para cuándo, o vacío si no aplica",
  "palabras": [{"ingles": "término difícil", "espanol": "qué significa"}],
  "preguntar": ["1 o 2 preguntas útiles para hacerle al médico o al seguro"]
}
Si no se puede leer o no es un papel, responde {"legible": false}.`

export async function explainPaper(file) {
  const blob = await compress(file)
  const image_base64 = await toBase64(blob)
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(GEMINI_VISION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ feature: 'diario', image_base64, media_type: 'image/jpeg', prompt: PROMPT }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((res.status === 429 || res.status === 413) && data?.message ? data.message : 'No pude leer el papel ahora. Intenta de nuevo en un rato.')
  if (!data || data.error) throw new Error('No pude entender bien la foto. Prueba con más luz y el papel derecho.')
  return data
}

export function paperToText(d) {
  if (!d?.legible) return 'No pude leer bien ese papel 😕 Prueba con más luz, el papel derecho y que se vea completo.'
  const out = []
  out.push(`📄 ${d.tipo || 'Este papel'}${d.de_quien ? ` — de ${d.de_quien}` : ''}`)
  if (d.resumen) out.push(d.resumen)
  const list = (title, arr) => { if (Array.isArray(arr) && arr.filter(Boolean).length) out.push(`${title}\n${arr.filter(Boolean).map(x => `• ${x}`).join('\n')}`) }
  list('✅ Qué hay que hacer:', d.hay_que_hacer)
  list('📅 Fechas:', d.fechas)
  if (d.dinero) out.push(`💵 ${d.dinero}`)
  if (Array.isArray(d.palabras) && d.palabras.length) list('🔤 Palabras en inglés:', d.palabras.slice(0, 5).map(p => `${p.ingles}: ${p.espanol}`))
  list('❓ Pueden preguntar:', d.preguntar)
  out.push('Esto es solo una explicación del papel. Ante dudas de salud, consulten a su médico.')
  return out.join('\n\n')
}
