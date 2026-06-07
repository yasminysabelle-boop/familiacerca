import { useState } from 'react'

function toLocalDate(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = toLocalDate()
  const yesterday = toLocalDate(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function fmtTime(isoStr) {
  if (!isoStr) return null
  return new Date(isoStr).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function MedicationHistorialTab({ medications = [], logsByMedId = {}, omissionsByMedId = {}, loading = false }) {
  const [expandedDays, setExpandedDays] = useState(new Set([toLocalDate()]))

  const scheduled = medications.filter(m => m.frequency !== 'as_needed')

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i)
    return toLocalDate(d)
  })

  if (loading) {
    return (
      <div style={{ padding: '16px 0 96px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 56, borderRadius: 12, background: '#F3F4F6', animation: 'skeletonShimmer 1.4s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  if (scheduled.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Sin medicamentos programados</p>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>El historial aparecerá aquí una vez que haya dosis registradas.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0 96px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {days.map(dateKey => {
        const isExpanded = expandedDays.has(dateKey)

        const medStatuses = scheduled.map(med => {
          const dayLogs = logsByMedId[med.id]?.[dateKey] ?? []
          const confirmed = dayLogs.find(l => l.status === 'confirmed')
          const missed    = dayLogs.find(l => l.status === 'missed')
          if (confirmed) return { med, status: 'confirmed', log: confirmed }
          if (missed)    return { med, status: 'missed',    log: missed }
          return { med, status: 'none', log: null }
        })

        const confirmedCount = medStatuses.filter(s => s.status === 'confirmed').length
        const total = scheduled.length
        const pct = total > 0 ? Math.round((confirmedCount / total) * 100) : 100

        const pctColor  = pct === 100 ? '#15803D' : pct >= 75 ? '#D97706' : '#DC2626'
        const pctBg     = pct === 100 ? '#F0FDF4' : pct >= 75 ? '#FFFBEB' : '#FEF2F2'
        const pctBorder = pct === 100 ? '#BBF7D0' : pct >= 75 ? '#FDE68A' : '#FCA5A5'

        return (
          <div key={dateKey} style={{ background: 'white', borderRadius: 14, border: `1px solid ${pctBorder}`, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <button
              onClick={() => setExpandedDays(prev => {
                const next = new Set(prev)
                next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey)
                return next
              })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: pctBg, border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>{dayLabel(dateKey)}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, background: 'rgba(255,255,255,0.7)', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
                {pct === 100 ? `✅ ${pct}%` : `⚠️ ${pct}% · ${total - confirmedCount} ${total - confirmedCount === 1 ? 'omisión' : 'omisiones'}`}
              </span>
              <span style={{ fontSize: 15, color: '#9CA3AF', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>›</span>
            </button>

            {isExpanded && (
              <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {medStatuses.map(({ med, status, log }) => {
                  const isConfirmed  = status === 'confirmed'
                  const isOmitted    = status === 'missed'
                  const isNone       = status === 'none'
                  const isAutoMissed = isOmitted && log?.confirmed_by_name === 'Sistema automático'
                  const confTime     = fmtTime(log?.confirmed_at)
                  const byFirst      = log?.confirmed_by_name?.split(' ')[0]
                  const givenLate    = log?.given_on_time === false
                  const minsLate     = log?.minutes_late
                  const omission     = omissionsByMedId[med.id]?.[dateKey]
                  const reason       = omission?.reason

                  const icon = isConfirmed && !givenLate ? '✅'
                    : isConfirmed && givenLate ? '⚠️'
                    : isAutoMissed ? '❌'
                    : isOmitted ? '⚠️'
                    : '🔵'

                  const rowBg = isConfirmed ? '#F0FDF4'
                    : isAutoMissed ? '#FEF2F2'
                    : isOmitted ? '#FFFBEB'
                    : '#F9FAFB'

                  let statusLabel, statusColor, detailLine
                  if (isConfirmed && !givenLate) {
                    statusLabel = 'A tiempo'; statusColor = '#15803D'
                    detailLine  = confTime ? `${byFirst ? byFirst + ' · ' : ''}${confTime}` : byFirst ?? null
                  } else if (isConfirmed && givenLate) {
                    statusLabel = `Tarde ${minsLate}min`; statusColor = '#D97706'
                    detailLine  = confTime ? `${byFirst ? byFirst + ' · ' : ''}${confTime}` : byFirst ?? null
                  } else if (isAutoMissed) {
                    statusLabel = 'Sistema'; statusColor = '#DC2626'
                    detailLine  = 'Ventana clínica vencida'
                  } else if (isOmitted) {
                    statusLabel = 'Omitido'; statusColor = '#92400E'
                    detailLine  = [byFirst, reason].filter(Boolean).join(' · Motivo: ') || null
                  } else {
                    statusLabel = 'Sin registro'; statusColor = '#6B7280'
                    detailLine  = null
                  }

                  return (
                    <div key={med.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, background: rowBg }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{med.name}</p>
                        {detailLine && (
                          <p style={{ fontSize: 11, color: '#6B7280', margin: '1px 0 0' }}>{detailLine}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
