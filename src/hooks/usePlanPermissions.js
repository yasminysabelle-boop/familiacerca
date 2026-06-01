import { useSubscription } from '../contexts/SubscriptionContext'
import { useFamily } from '../contexts/FamilyContext'

export function usePlanPermissions() {
  const { sub, isPaid, isTrialing, trialExpired } = useSubscription()
  const { memberRole } = useFamily()

  const plan = sub?.plan ?? 'free'
  const isAdmin = memberRole === null
  const isCuidador = memberRole === 'cuidador'
  const isFamiliar = memberRole === 'familiar'
  const canWrite = isAdmin || isCuidador
  // Paywall only blocks the admin — invited members are not responsible for payment
  const adminBlocked = trialExpired && isAdmin

  return {
    // Core write actions — only admin is blocked when trial expired
    canAddMedication:  !adminBlocked && canWrite,
    canAddNote:        !adminBlocked && canWrite,
    canAddExpense:     !adminBlocked && canWrite,
    canAddDiaryEntry:  !adminBlocked && canWrite,
    canInviteMember:   !adminBlocked && isAdmin,

    // Feature access by plan — only admin sees paywall gates
    canViewExpenses:   !adminBlocked,
    canViewAlbum:      !adminBlocked,
    canExportReport:   !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),
    canViewDirectory:  !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),
    canViewTimeline:   !adminBlocked && (plan === 'familiar' || plan === 'care_plus'),

    // Member limits
    maxMembers: plan === 'care_plus' ? Infinity : plan === 'familiar' ? 6 : 2,

    // Metadata
    plan,
    trialExpired,
    isPaid,
    isTrialing,
    isAdmin,
    isCuidador,
    isFamiliar,
  }
}
