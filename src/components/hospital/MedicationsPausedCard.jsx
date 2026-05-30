import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFamily } from '../../contexts/FamilyContext'

export default function MedicationsPausedCard() {
  const { ownerId } = useFamily()
  const [meds, setMeds] = useState([])

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('medications')
      .select('id, name, dosage, scheduled_times')
      .eq('user_id', ownerId)
      .order('name')
      .then(({ data }) => setMeds(data ?? []))
  }, [ownerId])

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1.5px solid #FED7AA',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>💊</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400E', flex: 1 }}>
          Medicamentos
        </h3>
        <span style={{
          padding: '3px 10px', borderRadius: 20,
          background: '#FED7AA', color: '#92400E',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
        }}>
          ⏸ PAUSADOS
        </span>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#B45309' }}>
        Solo lectura durante el Modo Hospital. Los recordatorios están desactivados.
      </p>

      {meds.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>Sin medicamentos registrados</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meds.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: '#FFF7ED', border: '1px solid #FED7AA',
                opacity: 0.85,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>💊</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                  {m.name}
                </p>
                {m.dosage && (
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: '#B45309' }}>
                    {m.dosage}
                    {m.scheduled_times?.length > 0 && ` · ${m.scheduled_times.join(', ')}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
