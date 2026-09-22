import type { StoragePort } from '../../workspace/repository'
import { assignmentFinding, assignments, coverageGaps } from './coverage'
import type { StaffAssignment } from './coverage'

export interface ShiftLedger {
  staff: readonly StaffAssignment[]
  transferApproved: boolean
  transferSourceRevision: number | null
  rosterOwner: string
  transferReviewer: string | null
  revision: number
  history: readonly { revision: number; action: string; staffId: string; actor?: string }[]
}
const key = 'careroster:ward-icu:night:2026-09-14:v1'
export const initialShiftLedger: ShiftLedger = { staff: assignments, transferApproved: false, transferSourceRevision: null, rosterOwner: 'roster coordinator', transferReviewer: null, revision: 0, history: [] }
export function readShiftLedger(storage: StoragePort): ShiftLedger {
  const raw = storage.getItem(key)
  if (!raw) return initialShiftLedger
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('staff' in value) || !Array.isArray(value.staff) ||
    !('transferApproved' in value) || typeof value.transferApproved !== 'boolean' ||
    !('revision' in value) || typeof value.revision !== 'number' ||
    !('history' in value) || !Array.isArray(value.history)) throw new Error('Invalid ward-shift record.')
  const record = value as Omit<ShiftLedger, 'rosterOwner' | 'transferReviewer'> & Partial<Pick<ShiftLedger, 'rosterOwner' | 'transferReviewer'>>
  return { ...record, transferSourceRevision: record.transferSourceRevision ?? null, rosterOwner: record.rosterOwner ?? 'roster coordinator', transferReviewer: record.transferReviewer ?? null }
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
  return { ...state, revision, staff: [...state.staff, candidate],
    history: [...state.history, { revision, action: 'assigned', staffId: candidate.id }] }
}
export function approveTransfer(state: ShiftLedger, actor: string, date = '2026-09-14'): ShiftLedger {
  const policy = transferReviewPolicy(state, actor, date)
  if (!policy.allowed) throw new Error(policy.blockers[0])
  if (state.transferApproved) throw new Error('Transfer coverage is already approved.')
  const revision = state.revision + 1
  return { ...state, revision, transferApproved: true, transferSourceRevision: revision, transferReviewer: actor,
    history: [...state.history, { revision, action: 'transfer-approved', staffId: 'WARD-ICU', actor }] }
}
export function changeCredential(state: ShiftLedger, id: string, until: string): ShiftLedger {
  if (!state.staff.some(person => person.id === id)) throw new Error('Staff member is not assigned.')
  const revision = state.revision + 1
  return { ...state, revision, staff: state.staff.map(person => person.id === id ? { ...person, credentialUntil: until } : person),
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
    history: [...state.history, { revision, action: 'removed', staffId: id }] }
}
export function saveShiftLedger(storage: StoragePort, state: ShiftLedger): ShiftLedger {
  storage.setItem(key, JSON.stringify(state))
  return state
}
