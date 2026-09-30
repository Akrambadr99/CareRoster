import { describe, expect, it } from 'vitest'
import { StoredDataError } from '../../workspace/storageValidation'
import { readShiftCollection, saveShiftCollection, seedShiftCollection } from './shiftCollection'
import type { ShiftCollection } from './shiftCollection'
import { approveTransfer, changeCredential, initialShiftLedger, removeStaff } from './shiftLedger'

const key = 'careroster:shift-collection:v1'
const legacyKey = 'careroster:ward-icu:night:2026-09-14:v1'
function storage(entries: [string, string][] = []) {
  const values = new Map(entries), writes: string[] = []
  return { values, writes, getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, raw: string) => { writes.push(name); values.set(name, raw) } }
}
const seed = seedShiftCollection(), first = seed.shifts[0]!, ready = seed.shifts[1]!, staff = first.ledger.staff[0]!
const replace = (record: unknown) => ({ ...seed, shifts: [record] })
describe('ward shift collection integrity', () => {
  it.each([
    ['null record', replace(null)], ['missing ledger', replace({ ...first, ledger: {} })],
    ['negative revision', replace({ ...first, ledger: { ...first.ledger, revision: -1 } })],
    ['staff skill enum', replace({ ...first, ledger: { ...first.ledger, staff: [{ ...staff, skill: 'unknown' }] } })],
    ['staff time type', replace({ ...first, ledger: { ...first.ledger, staff: [{ ...staff, starts: '19' }] } })],
    ['invalid calendar date', replace({ ...first, ledger: { ...first.ledger, staff: [{ ...staff, credentialUntil: '2026-02-31' }] } })],
    ['review enum', replace({ ...ready, ledger: { ...ready.ledger, transferReviews: [{ ...ready.ledger.transferReviews?.[0], status: 'unknown' }] } })],
    ['credential work enum', replace({ ...first, ledger: { ...first.ledger, credentialWork: [{ id: 'CW-1', staffId: staff.id, sourceRevision: 1, assigneeId: null, status: 'unknown' }] } })],
    ['null history event', replace({ ...first, ledger: { ...first.ledger, history: [null] } })],
    ['duplicate shifts', { ...seed, shifts: [first, first] }],
    ['duplicate staff identities', replace({ ...first, ledger: { ...first.ledger, staff: [staff, staff] } })],
    ['duplicate credential identities', { ...seed, credentials: [seed.credentials[0], seed.credentials[0]] }],
    ['invalid linked shift identity', { ...seed, credentials: [{ ...seed.credentials[0], shiftIds: [null] }] }],
    ['invalid audit entry', { ...seed, audit: [{ action: 'updated', id: first.id, related: 'not-an-array' }] }],
  ])('rejects %s without touching saved bytes', (_name, value) => {
    const raw = JSON.stringify(value), port = storage([[key, raw]])
    expect(() => readShiftCollection(port)).toThrow(StoredDataError)
    expect(port.values.get(key)).toBe(raw)
    expect(port.writes).toEqual([])
  })
  it.each(['', '{', 'null'])('does not seed over unreadable primary data %j', raw => {
    const port = storage([[key, raw]])
    expect(() => readShiftCollection(port)).toThrow(StoredDataError)
    expect(port.values.get(key)).toBe(raw)
    expect(port.writes).toEqual([])
  })
  it('preserves metadata and omitted optional work in a valid round trip', () => {
    const port = storage(), value = { ...seed, importMetadata: { batch: 'offline-copy', retained: true },
      shifts: [{ ...first, localNote: 'retained', ledger: { ...first.ledger, transferReviews: undefined, credentialWork: undefined } }] }
    saveShiftCollection(port, value)
    expect(readShiftCollection(port)).toEqual(JSON.parse(JSON.stringify(value)))
    expect(port.writes).toEqual([key])
  })
  it('validates before writing an invalid runtime candidate', () => {
    const raw = JSON.stringify(seed), port = storage([[key, raw]])
    expect(() => saveShiftCollection(port, replace(null) as unknown as ShiftCollection)).toThrow(StoredDataError)
    expect(port.values.get(key)).toBe(raw)
    expect(port.writes).toEqual([])
  })
  it('normalizes a valid legacy ledger without modifying either storage key', () => {
    const raw = JSON.stringify({ ...initialShiftLedger, rosterOwner: undefined, transferReviewer: undefined, transferSourceRevision: undefined, transferReviews: undefined, credentialWork: undefined })
    const port = storage([[legacyKey, raw]])
    expect(readShiftCollection(port).shifts[0]?.ledger.rosterOwner).toBe('roster coordinator')
    expect(port.values.get(legacyKey)).toBe(raw)
    expect(port.values.has(key)).toBe(false)
    expect(port.writes).toEqual([])
  })
  it('does not seed over an empty legacy source when the collection is absent', () => {
    const port = storage([[legacyKey, '']])
    expect(() => readShiftCollection(port)).toThrow(StoredDataError)
    expect(port.values.get(legacyKey)).toBe('')
    expect(port.values.has(key)).toBe(false)
    expect(port.writes).toEqual([])
  })
  it('rejects malformed migration output and identifies the retained legacy source', () => {
    const raw = JSON.stringify({ ...initialShiftLedger, staff: [null] }), port = storage([[legacyKey, raw]])
    try { readShiftCollection(port); expect.fail('Malformed legacy output should fail validation.') }
    catch (error) { expect(error).toBeInstanceOf(StoredDataError); expect(error).toHaveProperty('key', legacyKey) }
    expect(port.values.get(legacyKey)).toBe(raw)
    expect(port.writes).toEqual([])
  })
  it('retains stale approval, expired credentials and roster gaps as valid business states', () => {
    const approved = approveTransfer(ready.ledger, 'clinical lead')
    const stale = changeCredential(approved, 'RN-1', '2026-09-13')
    const missingStaff = removeStaff(first.ledger, 'RN-1')
    const value = { ...seed, shifts: seed.shifts.map(record => record.id === ready.id ? { ...record, ledger: stale } : record.id === first.id ? { ...record, ledger: missingStaff } : record) }
    const port = storage()
    saveShiftCollection(port, value)
    expect(readShiftCollection(port)).toEqual(value)
  })
})
