import { describe, expect, it } from 'vitest'
import { archiveShift, claimShiftTransfer, readShiftCollection, requestShiftTransfers,
  reviseCredential, saveShiftCollection, seedShiftCollection, shiftById, shiftInbox } from './shiftCollection'

function storage() { const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
describe('persisted ward shift collection', () => {
  it('holds independent ward rosters and a clinical work queue', () => {
    const state = seedShiftCollection()
    expect(state.shifts).toHaveLength(5)
    expect(shiftInbox(state).map(item => item.shiftId)).toEqual(['ED-NIGHT-15', 'ICU-NIGHT-15'])
    expect(shiftById(state, 'ED-NIGHT-15').ledger.staff.some(person => person.id === 'RN-1')).toBe(false)
  })
  it('claims one named clinical review and persists the independent other shift', () => {
    const port = storage(); const state = seedShiftCollection()
    const next = claimShiftTransfer(state, 'ICU-NIGHT-15', 'lead-mira', shiftById(state, 'ICU-NIGHT-15').ledger.revision)
    saveShiftCollection(port, next)
    expect(shiftInbox(readShiftCollection(port)).find(item => item.shiftId === 'ICU-NIGHT-15')?.assigneeId).toBe('lead-mira')
    expect(shiftInbox(readShiftCollection(port)).find(item => item.shiftId === 'ED-NIGHT-15')?.assigneeId).toBeNull()
  })
  it('propagates shared credential revision only to linked shifts', () => {
    const state = seedShiftCollection(); const result = reviseCredential(state, 'RN-1', '2026-09-13', 1)
    expect(result.updated).toEqual(['ICU-NIGHT-14', 'ICU-NIGHT-15'])
    expect(shiftById(result.collection, 'ICU-NIGHT-15').ledger.transferReviews?.at(-1)?.status).toBe('stale')
    expect(shiftById(result.collection, 'ED-NIGHT-15').ledger.revision).toBe(shiftById(state, 'ED-NIGHT-15').ledger.revision)
    expect(() => reviseCredential(result.collection, 'RN-1', '2026-12-31', 1)).toThrow('revision changed')
  })
  it('reports selected partial request outcomes and protects open reviews', () => {
    const state = seedShiftCollection(); const result = requestShiftTransfers(state, ['ICU-NIGHT-15', 'ED-DAY-16', 'ICU-DAY-16', 'missing'])
    expect(result.skipped).toEqual(['ICU-DAY-16'])
    expect(result.blocked.map(item => item.id)).toEqual(['ICU-NIGHT-15', 'ED-DAY-16', 'missing'])
    expect(() => archiveShift(state, 'ICU-NIGHT-15')).toThrow('transfer review')
  })
})
