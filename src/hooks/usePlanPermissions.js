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
  const hasPlanAccess = isPaid || isTrialing
  const hasPaidFeatures = isPaid || (isTrialing && !trialExpired)

  return {
    // Core write actions — blocked when trial expired
    canAddMedication:  !trialExpired && canWrite,
    canAddNote:        !trialExpired && canWrite,
    canAddExpense:     !trialExpired && canWrite,
    canAddDiaryEntry:  !trialExpired && canWrite,
    canInviteMember:   !trialExpired && isAdmin,

    // Feature access by plan
    canViewExpenses:   !trialExpired,
    canViewAlbum:      !trialExpired,
    canExportReport:   !trialExpired && (plan === 'familiar' || plan === 'care_plus'),
    canViewDirectory:  !trialExpired && (plan === 'familiar' || plan === 'care_plus'),
    canViewTimeline:   !trialExpired && (plan === 'familiar' || plan === 'care_plus'),

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
