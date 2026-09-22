import type { StoragePort } from '../../workspace/repository'
import { assignmentFinding, assignments, coverageGaps } from './coverage'
import type { StaffAssignment } from './coverage'

export interface ShiftLedger {
  staff: readonly StaffAssignment[]
  transferApproved: boolean
  transferSourceRevision: number | null
  rosterOwner: string
  transferReviewer: string | null
  transferReviews?: readonly TransferReview[] | undefined
  credentialWork?: readonly CredentialWork[] | undefined
  revision: number
  history: readonly { revision: number; action: string; staffId: string; actor?: string }[]
}
export interface TransferReview {
  id: string
  sourceRevision: number
  requestedBy: string
  assignee: string
  assigneeId?: string | null
  status: 'open' | 'stale' | 'completed' | 'superseded'
  supersedesId?: string
  outcome?: 'approved' | 'changes_requested'
  reason?: string
}
export interface CredentialWork {
  id: string
  staffId: string
  sourceRevision: number
  assigneeId: string | null
  status: 'open' | 'completed'
}
const key = 'careroster:ward-icu:night:2026-09-14:v1'
export const initialShiftLedger: ShiftLedger = { staff: assignments, transferApproved: false, transferSourceRevision: null, rosterOwner: 'roster coordinator', transferReviewer: null, transferReviews: [], credentialWork: [], revision: 0, history: [] }
export function readShiftLedger(storage: StoragePort): ShiftLedger {
  const raw = storage.getItem(key)
  if (!raw) return initialShiftLedger
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('staff' in value) || !Array.isArray(value.staff) ||
    !('transferApproved' in value) || typeof value.transferApproved !== 'boolean' ||
    !('revision' in value) || typeof value.revision !== 'number' ||
    !('history' in value) || !Array.isArray(value.history)) throw new Error('Invalid ward-shift record.')
  const record = value as Omit<ShiftLedger, 'rosterOwner' | 'transferReviewer'> & Partial<Pick<ShiftLedger, 'rosterOwner' | 'transferReviewer'>>
  return { ...record, transferSourceRevision: record.transferSourceRevision ?? null, rosterOwner: record.rosterOwner ?? 'roster coordinator', transferReviewer: record.transferReviewer ?? null,
    transferReviews: record.transferReviews ?? [], credentialWork: record.credentialWork ?? [] }
}
export function clinicalInbox(state: ShiftLedger, actor: string): TransferReview[] {
  return (state.transferReviews ?? []).filter(item => item.assignee === actor && item.status === 'open')
}
export function requestTransferReview(state: ShiftLedger, actor: string, assignee = 'clinical lead'): ShiftLedger {
  if (actor !== state.rosterOwner || assignee !== 'clinical lead' || actor === assignee) throw new Error('Coordinator must hand off to an independent clinical lead.')
  if (state.transferApproved || coverageGaps(state.staff, '2026-09-14').length) throw new Error('Resolve uncovered role-hours before requesting review.')
  if (state.transferReviews?.some(item => item.status === 'open')) throw new Error('A current transfer review already exists.')
  const revision = state.revision + 1
  const previous = [...(state.transferReviews ?? [])].reverse().find(item => item.status === 'stale')
  const review: TransferReview = { id: `TRANSFER-${String(revision)}`, sourceRevision: revision, requestedBy: actor, assignee,
    assigneeId: null, status: 'open', ...(previous ? { supersedesId: previous.id } : {}) }
  return { ...state, revision, transferReviews: [...(state.transferReviews ?? []).map(item => item.id === previous?.id ?
    { ...item, status: 'superseded' as const } : item), review],
    history: [...state.history, { revision, action: 'transfer-review-requested', staffId: 'WARD-ICU', actor }] }
}
export function requestTransferChanges(state: ShiftLedger, actor: string, reason: string): ShiftLedger {
  const review = clinicalInbox(state, actor).find(item => item.sourceRevision === state.revision)
  if (!review || reason.trim().length < 12) throw new Error('A current review and clinical reason are required.')
  const revision = state.revision + 1
  return { ...state, revision, transferReviews: state.transferReviews?.map(item => item.id === review.id ?
    { ...item, status: 'completed' as const, outcome: 'changes_requested' as const, reason } : item),
    history: [...state.history, { revision, action: 'transfer-changes-requested', staffId: 'WARD-ICU', actor }] }
}
export function transferReviewPolicy(state: ShiftLedger, actor: string, date = '2026-09-14'): { allowed: boolean; blockers: string[]; queue: 'coverage' | 'clinical-review' | 'stale-review' } {
  const blockers = transferBlockers(state, date).filter(item => !item.includes('stale after'))
  if (actor !== 'clinical lead') blockers.push('Only the clinical lead may independently approve transfer coverage.')
  if (actor === state.rosterOwner) blockers.push('The roster owner cannot approve their own transfer proposal.')
  return { allowed: blockers.length === 0, blockers, queue: blockers.some(item => item.includes('uncovered')) ? 'coverage' : state.transferApproved && state.transferSourceRevision !== state.revision ? 'stale-review' : 'clinical-review' }
}
export function transferBlockers(state: ShiftLedger, date = '2026-09-14'): string[] {
  const gaps = coverageGaps(state.staff, date)
  const blockers = gaps.length ? [String(gaps.length) + ' uncovered role-hour(s) block patient transfer.'] : []
  if (state.transferApproved && state.transferSourceRevision !== state.revision) blockers.push('Transfer approval is stale after a roster or credential revision.')
  return blockers
}
export function assignStaff(state: ShiftLedger, candidate: StaffAssignment, date = '2026-09-14'): ShiftLedger {
  const finding = assignmentFinding(state.staff, candidate, date)
  if (finding) throw new Error(finding)
  const revision = state.revision + 1
  return { ...state, revision, staff: [...state.staff, candidate], transferReviews: state.transferReviews?.map(item =>
    item.status === 'open' ? { ...item, status: 'stale' as const } : item),
    history: [...state.history, { revision, action: 'assigned', staffId: candidate.id }] }
}
export function approveTransfer(state: ShiftLedger, actor: string, date = '2026-09-14', reviewerId?: string): ShiftLedger {
  const policy = transferReviewPolicy(state, actor, date)
  if (!policy.allowed) throw new Error(policy.blockers[0])
  if (state.transferApproved) throw new Error('Transfer coverage is already approved.')
  if (state.transferReviews?.length && !clinicalInbox(state, actor).some(item => item.sourceRevision === state.revision))
    throw new Error('A current clinical review must be assigned to this lead.')
  if (state.transferReviews?.some(item => item.status === 'open' && item.assigneeId &&
    item.assigneeId !== reviewerId)) throw new Error('Transfer review belongs to another named clinical lead.')
  const revision = state.revision + 1
  return { ...state, revision, transferApproved: true, transferSourceRevision: revision, transferReviewer: actor,
    transferReviews: state.transferReviews?.map(item => item.status === 'open' ?
      { ...item, status: 'completed' as const, outcome: 'approved' as const } : item),
    history: [...state.history, { revision, action: 'transfer-approved', staffId: 'WARD-ICU', actor }] }
}
export function changeCredential(state: ShiftLedger, id: string, until: string, specialistId?: string): ShiftLedger {
  if (!state.staff.some(person => person.id === id)) throw new Error('Staff member is not assigned.')
  const revision = state.revision + 1
  const existing = (state.credentialWork ?? []).find(item => item.staffId === id && item.status === 'open')
  if (existing?.assigneeId && existing.assigneeId !== specialistId) throw new Error('Credential exception belongs to another named specialist.')
  const expired = until < '2026-09-14'
  const credentialWork: CredentialWork[] = [...(state.credentialWork ?? []).map(item => item.id === existing?.id ?
    expired ? { ...item, sourceRevision: revision, assigneeId: null } : { ...item, status: 'completed' as const } : item)]
  if (expired && !existing) credentialWork.push({ id: `CREDENTIAL-${id}-${String(revision)}`, staffId: id,
    sourceRevision: revision, assigneeId: null, status: 'open' })
  return { ...state, revision, staff: state.staff.map(person => person.id === id ? { ...person, credentialUntil: until } : person),
    transferReviews: state.transferReviews?.map(item => item.status === 'open' ? { ...item, status: 'stale' as const } : item),
    credentialWork,
    history: [...state.history, { revision, action: 'credential-reviewed', staffId: id }] }
}
export function revalidateTransfer(state: ShiftLedger, actor: string, date = '2026-09-14'): ShiftLedger {
  if (!state.transferApproved || state.transferSourceRevision === state.revision) throw new Error('No stale transfer approval exists.')
  const gaps = coverageGaps(state.staff, date)
  if (gaps.length) throw new Error(String(gaps.length) + ' uncovered role-hour(s) require qualified replacement before revalidation.')
  const policy = transferReviewPolicy(state, actor, date)
  if (!policy.allowed) throw new Error(policy.blockers[0])
  const revision = state.revision + 1
  return { ...state, revision, transferSourceRevision: revision,
    history: [...state.history, { revision, action: 'transfer-revalidated', staffId: 'WARD-ICU', actor }] }
}
export function removeStaff(state: ShiftLedger, id: string): ShiftLedger {
  if (state.transferApproved) throw new Error('Approved transfer depends on the current shift assignment.')
  if (!state.staff.some(person => person.id === id)) throw new Error('Staff member is not assigned.')
  const revision = state.revision + 1
  return { ...state, revision, staff: state.staff.filter(person => person.id !== id),
    transferReviews: state.transferReviews?.map(item => item.status === 'open' ? { ...item, status: 'stale' as const } : item),
    history: [...state.history, { revision, action: 'removed', staffId: id }] }
}
export function saveShiftLedger(storage: StoragePort, state: ShiftLedger): ShiftLedger {
  storage.setItem(key, JSON.stringify(state))
  return state
}
