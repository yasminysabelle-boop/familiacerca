import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFamily } from '../../contexts/FamilyContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Medications from '../Medications'
import MedicationList from './MedicationList'
import MedicationStockList from './MedicationStockList'

function toLocalDate(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
}

export default function MedicationTabs() {
  const { ownerId } = useFamily()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('hoy')
  const [pendingCount, setPendingCount] = useState(0)

  // Auto-switch to Hoy when edit/add URL params arrive (from MedicationList)
  useEffect(() => {
    if (searchParams.get('edit') || searchParams.get('add') === '1') {
      setActiveTab('hoy')
    }
  }, [searchParams])

  // Badge: pending meds today
  useEffect(() => {
    if (!ownerId) return
    const today = toLocalDate()
    async function load() {
      const [{ data: meds }, { data: logs }] = await Promise.all([
        supabase.from('medications').select('id, frequency').eq('user_id', ownerId),
        supabase.from('medication_logs').select('medication_id')
          .eq('user_id', ownerId).eq('log_date', today).eq('status', 'confirmed'),
      ])
      const confirmed = new Set((logs ?? []).map(l => l.medication_id))
      const pending = (meds ?? []).filter(
        m => m.frequency !== 'as_needed' && !confirmed.has(m.id)
      ).length
      setPendingCount(pending)
    }
    load()
  }, [ownerId])

  const TABS = [
    { id: 'hoy',   label: 'Hoy',   badge: pendingCount },
    { id: 'todos', label: 'Todos', badge: 0 },
    { id: 'stock', label: 'Stock', badge: 0 },
  ]

  return (
    <Layout>
      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #EDE5D8',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '13px 8px 11px',
                border: 'none',
                borderBottom: active
                  ? '2.5px solid #2D4A1E'
                  : '2.5px solid transparent',
                background: 'none',
                cursor: 'pointer',
                color: active ? '#2D4A1E' : '#9CA3AF',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                position: 'relative',
                transition: 'color 0.15s, border-color 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 8,
                  right: 'calc(50% - 22px)',
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#DC2626',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      {activeTab === 'hoy'   && <Medications onConfirmed={() => {
        // Refresh badge when a medication is confirmed
        const today = toLocalDate()
        if (!ownerId) return
        supabase.from('medication_logs').select('medication_id')
          .eq('user_id', ownerId).eq('log_date', today).eq('status', 'confirmed')
          .then(({ data }) => {
            supabase.from('medications').select('id, frequency').eq('user_id', ownerId)
              .then(({ data: meds }) => {
                const confirmed = new Set((data ?? []).map(l => l.medication_id))
                setPendingCount(
                  (meds ?? []).filter(m => m.frequency !== 'as_needed' && !confirmed.has(m.id)).length
                )
              })
          })
      }} />}
      {activeTab === 'todos' && <MedicationList />}
      {activeTab === 'stock' && <MedicationStockList />}
    </Layout>
  )
}
