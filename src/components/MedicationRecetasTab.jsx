import { FileText, Image as ImageIcon } from './Icons'

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

// MedicationRecetasTab — galería de solo lectura de documentos ya subidos.
// Subir/reemplazar documentos vive en el Detalle de cada medicamento.
export default function MedicationRecetasTab({ medications = [], stockByMedId = {}, onViewDoc }) {
  const docs = medications.flatMap(med => {
    const stock = stockByMedId[med.id]
    if (!stock) return []
    const updatedAt = fmtDate(stock.updated_at)
    const entries = []
    if (stock.prescription_photo_url) {
      entries.push({ key: `${med.id}-rx`, medName: med.name, url: stock.prescription_photo_url, updatedAt, kind: 'receta' })
    }
    if (stock.box_photo_url) {
      entries.push({ key: `${med.id}-box`, medName: med.name, url: stock.box_photo_url, updatedAt, kind: 'caja' })
    }
    return entries
  })

  return (
    <div style={{ padding: '12px 0 96px', fontFamily: SANS }}>
      <p style={{ fontSize: 13, color: '#6B7A88', marginBottom: 14 }}>
        Documentos que has subido para cada medicamento.
      </p>

      {docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {docs.map(doc => (
            <div key={doc.key} style={{ background: '#FFFFFF', borderRadius: 20, padding: 16, boxShadow: '0 6px 14px -8px #087F7033' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 60, borderRadius: 12, background: '#FBEAE4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {doc.kind === 'receta'
                    ? <FileText size={20} color="#D99A18" strokeWidth={1.8} />
                    : <ImageIcon size={20} color="#D99A18" strokeWidth={1.8} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1E2C3A' }}>{doc.medName}</div>
                  <div style={{ fontSize: 13, color: '#6B7A88', marginTop: 2 }}>
                    {doc.kind === 'receta' ? 'Receta médica' : 'Foto de la caja'}
                    {doc.updatedAt ? ` · Subida el ${doc.updatedAt}` : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onViewDoc(doc.url)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1EDE3', fontSize: 13.5, color: '#087F70', fontWeight: 700, fontFamily: SANS }}
              >
                Ver {doc.kind === 'receta' ? 'receta' : 'caja'} →
              </button>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 20, textAlign: 'center', boxShadow: '0 6px 14px -8px #087F7022' }}>
          <p style={{ fontSize: 13.5, color: '#6B7A88', lineHeight: 1.55, margin: 0 }}>
            Aún no has subido recetas. Puedes hacerlo desde cada medicamento.
          </p>
        </div>
      )}
    </div>
  )
}
