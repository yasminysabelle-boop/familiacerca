import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Aviso único, ANTES de que el trial venza (últimos días, ver daysLeft<=4 en
// Layout.jsx) -- distinto de TrialEndedNotice, que avisa DESPUÉS. Mismo
// patrón de "una sola vez" (trial_ending_seen_at, ver
// supabase/add_trial_ending_seen.sql), pero nunca puede coincidir con
// TrialEndedNotice en pantalla: uno exige isTrialing, el otro trialExpired,
// mutuamente excluyentes en BillingAccountContext.
//
// recommended_plan de care_complexity (Paso 3 del onboarding, ver
// project_familiacerca_onboarding_complexity) decide el caso a mostrar:
//   'free'                          -> caso A, sin empujar upgrade
//   'familiar' | null (saltó el quiz) -> caso B, recomienda Familiar
//   'care_plus'                     -> TAMBIÉN caso B, por ahora (ver nota
//     abajo) -- Cuidado Total no suma casi nada real sobre Familiar hoy
//     (trendLines y gastos avanzado sin construir), así que recomendarlo
//     sería cobrar el doble por algo que la persona probablemente no
//     necesita todavía. Cuidado Total sigue disponible en /upgrade para
//     quien lo busque explícitamente. Reactivar el caso C cuando trendLines
//     y gastos avanzado existan (ver memoria del proyecto).
export default function TrialEndingNotice({ daysLeft, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recommendedPlan, setRecommendedPlan] = useState(undefined) // undefined = cargando

  useEffect(() => {
    if (!user) return
    supabase
      .from('care_complexity')
      .select('recommended_plan')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setRecommendedPlan(data?.recommended_plan ?? null))
  }, [user])

  if (recommendedPlan === undefined) return null // esperando el fetch, no parpadear con el caso equivocado

  const isFree = recommendedPlan === 'free'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white', borderRadius: 24, padding: '32px 24px',
        maxWidth: 360, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>⏳</div>
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 19, fontWeight: 700,
          color: '#1A1A1A', margin: '0 0 16px', lineHeight: 1.3,
        }}>
          Quedan {daysLeft} día{daysLeft !== 1 ? 's' : ''} de tu prueba
        </h2>

        <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 12px', textAlign: 'left' }}>
          <strong style={{ color: '#1A1A1A' }}>Conservás:</strong> Milo y Luna en
          su nivel básico, marcar tus medicamentos como tomados, tu checklist
          diario, chat familiar, historial de los últimos 7 días y un equipo
          de hasta 2 personas.
        </p>

        {isFree ? (
          <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 22px', textAlign: 'left' }}>
            Por lo que nos contaste, <strong style={{ color: '#1A1A1A' }}>Gratis
            debería alcanzarte</strong> por ahora. Podés seguir así sin ningún
            problema — si el cuidado se vuelve más complejo, cambiás de plan
            cuando quieras.
          </p>
        ) : (
          <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 22px', textAlign: 'left' }}>
            <strong style={{ color: '#1A1A1A' }}>Con Familiar ($12.99/mes)
            sumás:</strong> volver a agregar y editar medicamentos y citas
            médicas, alertas automáticas si una dosis no aparece registrada,
            equipo de hasta 6 personas, historial de 90 días y gastos de
            cuidado.
          </p>
        )}

        {isFree ? (
          <>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: '#087F70',
                color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(8,127,112,0.3)', marginBottom: 10,
              }}
            >
              Entendido
            </button>
            <button
              onClick={() => { navigate('/upgrade'); onClose() }}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1.5px solid #EDE5D8', background: 'white',
                color: '#9CA3AF', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Ver todos los planes
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { navigate('/upgrade'); onClose() }}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: '#087F70',
                color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(8,127,112,0.3)', marginBottom: 10,
              }}
            >
              Ver Plan Familiar →
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1.5px solid #EDE5D8', background: 'white',
                color: '#9CA3AF', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Seguir en Gratis
            </button>
          </>
        )}
      </div>
    </div>
  )
}
