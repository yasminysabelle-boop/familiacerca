import { useSubscription } from '../contexts/SubscriptionContext'
import { useFamily } from '../contexts/FamilyContext'

export function usePlanPermissions() {
  const { sub, isPaid, isTrialing, trialExpired } = useSubscription()
  const { memberRole } = useFamily()

  const plan = sub?.plan ?? 'free'
  const isAdmin    = memberRole === null
  const isCuidador = memberRole === 'cuidador'
  const isFamiliar = memberRole === 'familiar'
  const canWrite   = isAdmin || isCuidador
  // Paywall only blocks the admin — invited members are not responsible for payment
  const adminBlocked = trialExpired && isAdmin

  return {
    // ── Medication actions ───────────────────────────────────────────────────
    canAddMedication:    !adminBlocked && isAdmin,    // admin only
    canEditMedication:   !adminBlocked && isAdmin,    // admin only
    canConfirmMedication: !adminBlocked && canWrite,  // cuidador + admin

    // ── Routine (care) actions ───────────────────────────────────────────────
    canCompleteRoutine:  !adminBlocked && canWrite,   // cuidador + admin
    canConfigureRoutine: !adminBlocked && isAdmin,    // admin only (schedules/times)

    // ── Notes / diary ────────────────────────────────────────────────────────
    canAddNote:          !adminBlocked && canWrite,   // cuidador + admin
    canAddDiaryEntry:    !adminBlocked && canWrite,   // cuidador + admin

    // ── Expenses ─────────────────────────────────────────────────────────────
    canAddExpense:       !adminBlocked && canWrite,   // cuidador + admin (own records)

    // ── Team management ──────────────────────────────────────────────────────
    canInviteMember:     !adminBlocked && isAdmin,    // admin only

    // ── Patient profile & directory ──────────────────────────────────────────
    canEditPatientProfile: isAdmin,                   // admin only
    canEditDirectory:      isAdmin,                   // admin only

    // ── Reports ──────────────────────────────────────────────────────────────
    canGeneratePDF:      !adminBlocked,               // all roles

    // ── Feature access by plan (admin sees paywall gate, others pass through) ─
    canViewExpenses:   !adminBlocked,
    canViewAlbum:      !adminBlocked,
    canExportReport:   !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),
    canViewDirectory:  !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),
    canViewTimeline:   !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),

    // ── Member limits ────────────────────────────────────────────────────────
    maxMembers: plan === 'care_plus' ? Infinity : plan === 'familiar' ? 6 : 2,

    // ── Metadata ─────────────────────────────────────────────────────────────
    plan,
    trialExpired,
    isPaid,
    isTrialing,
    isAdmin,
    isCuidador,
    isFamiliar,
  }
}
