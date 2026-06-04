import { useSubscription } from '../contexts/SubscriptionContext'
import { useFamily } from '../contexts/FamilyContext'

export function usePlanPermissions() {
  const { sub, isPaid, isTrialing, trialExpired, isAppAdmin } = useSubscription()
  const { memberRole } = useFamily()

  const plan = sub?.plan ?? 'free'
  const isAdmin    = memberRole === null
  const isCuidador = memberRole === 'cuidador'
  const isFamiliar = memberRole === 'familiar'
  const canWrite   = isAdmin || isCuidador
  // Paywall only blocks the admin — invited members are not responsible for payment.
  // App-level admins (isAppAdmin) are never blocked regardless of plan or trial state.
  const adminBlocked = !isAppAdmin && trialExpired && isAdmin
  const planUnlocked = isAppAdmin || plan === 'familiar' || plan === 'care_plus'

  return {
    // ── Medication actions ───────────────────────────────────────────────────
    canAddMedication:    !adminBlocked && isAdmin,
    canEditMedication:   !adminBlocked && isAdmin,
    canConfirmMedication: !adminBlocked && canWrite,

    // ── Routine (care) actions ───────────────────────────────────────────────
    canCompleteRoutine:  !adminBlocked && canWrite,
    canConfigureRoutine: !adminBlocked && isAdmin,

    // ── Notes / diary ────────────────────────────────────────────────────────
    canAddNote:          !adminBlocked && canWrite,
    canAddDiaryEntry:    !adminBlocked && canWrite,

    // ── Expenses ─────────────────────────────────────────────────────────────
    canAddExpense:       !adminBlocked && canWrite,

    // ── Team management ──────────────────────────────────────────────────────
    canInviteMember:     !adminBlocked && isAdmin,

    // ── Patient profile & directory ──────────────────────────────────────────
    canEditPatientProfile: isAdmin,
    canEditDirectory:      isAdmin,

    // ── Reports ──────────────────────────────────────────────────────────────
    canGeneratePDF:      !adminBlocked,

    // ── Feature access by plan ───────────────────────────────────────────────
    canViewExpenses:   !adminBlocked,
    canViewAlbum:      !adminBlocked,
    canExportReport:   !adminBlocked && planUnlocked,
    canViewDirectory:  !adminBlocked && planUnlocked,
    canViewTimeline:   !adminBlocked && planUnlocked,

    // ── Member limits ────────────────────────────────────────────────────────
    maxMembers: isAppAdmin || plan === 'care_plus' ? Infinity : plan === 'familiar' ? 6 : 2,

    // ── Metadata ─────────────────────────────────────────────────────────────
    plan,
    trialExpired,
    isPaid,
    isTrialing,
    isAppAdmin,
    isAdmin,
    isCuidador,
    isFamiliar,
  }
}
