import type { StoragePort } from '../../workspace/repository'
import { candidateAssignments } from './coverage'
import { assignStaff, changeCredential, initialShiftLedger, readShiftLedger, requestTransferReview } from './shiftLedger'
import type { ShiftLedger } from './shiftLedger'
import { careWorkInbox, claimTransferWork } from './clinicalWorkload'
import type { ShiftWorkRecord } from './clinicalWorkload'

export interface ShiftRecord { id: string; ward: string; ledger: ShiftLedger; archived: boolean }
export interface StaffCredential { id: string; revision: number; until: string; shiftIds: readonly string[] }
export interface ShiftCollection { shifts: readonly ShiftRecord[]; credentials: readonly StaffCredential[]; audit: readonly { action: string; id: string; related: readonly string[] }[] }
export interface ShiftBatch { collection: ShiftCollection; updated: string[]; skipped: string[]; blocked: { id: string; reason: string }[] }
const key = 'careroster:shift-collection:v1'
function ready(): ShiftLedger {
  let ledger = initialShiftLedger
  for (const staff of candidateAssignments.filter(item => item.id === 'RN-4' || item.id === 'RN-6')) ledger = assignStaff(ledger, staff)
  return requestTransferReview(ledger, 'roster coordinator')
}
function edStaff(ledger: ShiftLedger): ShiftLedger {
  return { ...ledger, staff: ledger.staff.map(person => ({ ...person, id: `ED-${person.id}` })) }
}
export function seedShiftCollection(legacy: ShiftLedger = initialShiftLedger): ShiftCollection {
  return { shifts: [
    { id: 'ICU-NIGHT-14', ward: 'ICU', ledger: legacy, archived: false },
    { id: 'ICU-NIGHT-15', ward: 'ICU', ledger: ready(), archived: false },
    { id: 'ED-NIGHT-15', ward: 'ED', ledger: edStaff(ready()), archived: false },
    { id: 'ED-DAY-16', ward: 'ED', ledger: edStaff(initialShiftLedger), archived: false },
    { id: 'ICU-DAY-16', ward: 'ICU', ledger: initialShiftLedger, archived: true },
  ], credentials: [
    { id: 'RN-1', revision: 1, until: '2026-12-31', shiftIds: ['ICU-NIGHT-14', 'ICU-NIGHT-15'] },
    { id: 'ED-RN-2', revision: 1, until: '2026-12-31', shiftIds: ['ED-NIGHT-15', 'ED-DAY-16'] },
  ], audit: [] }
}
export function readShiftCollection(storage: StoragePort): ShiftCollection {
  const raw = storage.getItem(key)
  if (!raw) return seedShiftCollection(readShiftLedger(storage))
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('shifts' in value) || !Array.isArray(value.shifts) ||
    !('credentials' in value) || !Array.isArray(value.credentials) || !('audit' in value) || !Array.isArray(value.audit))
    throw new Error('Invalid shift collection.')
  return value as ShiftCollection
}
export function saveShiftCollection(storage: StoragePort, value: ShiftCollection): ShiftCollection { storage.setItem(key, JSON.stringify(value)); return value }
export function shiftById(value: ShiftCollection, id: string): ShiftRecord {
  const record = value.shifts.find(item => item.id === id)
  if (!record) throw new Error(`Shift ${id} was not found.`)
  return record
}
export function shiftRows(value: ShiftCollection, query = '', filter = 'active'): ShiftRecord[] {
  const needle = query.trim().toLowerCase()
  return value.shifts.filter(item => (filter === 'all' || (filter === 'archived') === item.archived) &&
    (!needle || `${item.id} ${item.ward}`.toLowerCase().includes(needle))).toSorted((a, b) => a.id.localeCompare(b.id))
}
export function shiftInbox(value: ShiftCollection) {
  return careWorkInbox(value.shifts.filter(item => !item.archived).map(item => ({ shiftId: item.id, ward: item.ward, ledger: item.ledger })))
}
export function claimShiftTransfer(value: ShiftCollection, id: string, actorId: string, expectedRevision: number): ShiftCollection {
  const record = shiftById(value, id)
  if (record.archived) throw new Error('Archived shift cannot receive a transfer claim.')
  const records: ShiftWorkRecord[] = value.shifts.filter(item => !item.archived).map(item => ({ shiftId: item.id, ward: item.ward, ledger: item.ledger }))
  const ledger = claimTransferWork({ shiftId: id, ward: record.ward, ledger: record.ledger }, actorId, records, expectedRevision)
  return { ...value, shifts: value.shifts.map(item => item.id === id ? { ...item, ledger } : item),
    audit: [...value.audit, { action: 'transfer-claimed', id, related: [actorId] }] }
}
export function reviseCredential(value: ShiftCollection, id: string, until: string, expectedRevision: number): ShiftBatch {
  const credential = value.credentials.find(item => item.id === id)
  if (credential?.revision !== expectedRevision) throw new Error('Credential source revision changed.')
  const updated: string[] = []; const skipped: string[] = []; const blocked: ShiftBatch['blocked'] = []
  const shifts = value.shifts.map(item => {
    if (!credential.shiftIds.includes(item.id) || item.archived) { skipped.push(item.id); return item }
    try { const ledger = changeCredential(item.ledger, id, until); updated.push(item.id); return { ...item, ledger } }
    catch (error) { blocked.push({ id: item.id, reason: error instanceof Error ? error.message : 'Credential change blocked.' }); return item }
  })
  return { collection: { ...value, shifts, credentials: value.credentials.map(item => item.id === id ?
    { ...item, revision: item.revision + 1, until } : item),
    audit: [...value.audit, { action: 'credential-revised', id, related: updated }] }, updated, skipped, blocked }
}
export function requestShiftTransfers(value: ShiftCollection, ids: readonly string[]): ShiftBatch {
  const updated: string[] = []; const skipped: string[] = []; const blocked: ShiftBatch['blocked'] = []
  const unique = new Set(ids)
  const shifts = value.shifts.map(item => {
    if (!unique.has(item.id)) return item
    if (item.archived || item.ledger.transferApproved) { skipped.push(item.id); return item }
    try { const ledger = requestTransferReview(item.ledger, 'roster coordinator'); updated.push(item.id); return { ...item, ledger } }
    catch (error) { blocked.push({ id: item.id, reason: error instanceof Error ? error.message : 'Transfer request blocked.' }); return item }
  })
  for (const id of unique) if (!value.shifts.some(item => item.id === id)) blocked.push({ id, reason: 'Shift not found.' })
  return { collection: { ...value, shifts, audit: [...value.audit, { action: 'transfers-requested', id: 'selection', related: updated }] }, updated, skipped, blocked }
}
export function archiveShift(value: ShiftCollection, id: string): ShiftCollection {
  const record = shiftById(value, id)
  if (record.archived || record.ledger.transferReviews?.some(item => item.status === 'open') || record.ledger.transferApproved)
    throw new Error('Resolve transfer review or approval before archiving shift.')
  return { ...value, shifts: value.shifts.map(item => item.id === id ? { ...item, archived: true } : item),
    audit: [...value.audit, { action: 'shift-archived', id, related: [record.ward] }] }
}
