import type { StoragePort } from '../../workspace/repository'
import { assignmentFinding, assignments, coverageGaps } from './coverage'
import type { StaffAssignment } from './coverage'

export interface ShiftLedger {
  staff: readonly StaffAssignment[]
  transferApproved: boolean
  revision: number
  history: readonly { revision: number; action: string; staffId: string }[]
}
const key = 'careroster:ward-icu:night:2026-09-14:v1'
export const initialShiftLedger: ShiftLedger = { staff: assignments, transferApproved: false, revision: 0, history: [] }
export function readShiftLedger(storage: StoragePort): ShiftLedger {
  const raw = storage.getItem(key)
  if (!raw) return initialShiftLedger
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('staff' in value) || !Array.isArray(value.staff) ||
    !('transferApproved' in value) || typeof value.transferApproved !== 'boolean' ||
    !('revision' in value) || typeof value.revision !== 'number' ||
    !('history' in value) || !Array.isArray(value.history)) throw new Error('Invalid ward-shift record.')
  return value as ShiftLedger
}
export function transferBlockers(state: ShiftLedger, date = '2026-09-14'): string[] {
  const gaps = coverageGaps(state.staff, date)
  return gaps.length ? [String(gaps.length) + ' uncovered role-hour(s) block patient transfer.'] : []
}
export function assignStaff(state: ShiftLedger, candidate: StaffAssignment, date = '2026-09-14'): ShiftLedger {
  const finding = assignmentFinding(state.staff, candidate, date)
  if (finding) throw new Error(finding)
  const revision = state.revision + 1
  return { ...state, revision, staff: [...state.staff, candidate],
    history: [...state.history, { revision, action: 'assigned', staffId: candidate.id }] }
}
export function approveTransfer(state: ShiftLedger, date = '2026-09-14'): ShiftLedger {
  if (transferBlockers(state, date).length) throw new Error(transferBlockers(state, date)[0])
  if (state.transferApproved) throw new Error('Transfer coverage is already approved.')
  const revision = state.revision + 1
  return { ...state, revision, transferApproved: true,
    history: [...state.history, { revision, action: 'transfer-approved', staffId: 'WARD-ICU' }] }
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
