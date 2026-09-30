import { describe, expect, it } from 'vitest'
import { compareCollectionSnapshot, createCollectionSnapshot } from '../../workspace/collectionSnapshot'
import { collectionSnapshotAdapter as adapter } from './collectionSnapshot'
import { seedShiftCollection, reviseCredential } from './shiftCollection'
import { initialShiftLedger } from './shiftLedger'

const key = 'careroster:shift-collection:v1'
const seed = seedShiftCollection()
function storage(entries: [string, string][] = [[key, JSON.stringify(seed)]]) {
  const values = new Map(entries), writes: string[] = []
  return { values, writes, getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, raw: string) => { writes.push(name); values.set(name, raw) } }
}
function snapshot(payload: unknown) {
  return JSON.stringify({ format: 'collection-snapshot', version: 1, product: 'CareRoster',
    scope: 'shift-collection', createdAt: '2026-09-30T12:00:00.000Z', payload })
}

describe('CareRoster collection snapshot adapter', () => {
  it('exports the complete validated domain collection and compares it without writes', () => {
    const port = storage(), before = new Map(port.values)
    const raw = createCollectionSnapshot(adapter, port, '2026-09-30T12:00:00.000Z')
    expect(JSON.parse(raw)).toMatchObject({ product: 'CareRoster', scope: 'shift-collection', payload: seed })
    const comparison = compareCollectionSnapshot(raw, adapter, port)
    expect(comparison.payloadChanged).toBe(false)
    expect(comparison.rows.every(row => row.status === 'unchanged')).toBe(true)
    expect(adapter.groups(seed).map(group => group.key)).toEqual(['shifts', 'credentials'])
    expect(adapter.groups(seed).flatMap(group => group.records).map(record => record.id)).toContain('RN-1')
    expect(port.values).toEqual(before)
    expect(port.writes).toEqual([])
  })

  it.each([
    ['malformed nested evidence', { ...seed, shifts: [{ ...seed.shifts[0], ledger: { ...seed.shifts[0]!.ledger, staff: [null] } }] }],
    ['duplicate primary identities', { ...seed, shifts: [...seed.shifts, seed.shifts[0]] }],
    ['duplicate related identities', { ...seed, credentials: [...seed.credentials, seed.credentials[0]] }],
  ])('rejects %s without changing the current collection', (_name, payload) => {
    const port = storage(), before = new Map(port.values)
    expect(() => compareCollectionSnapshot(snapshot(payload), adapter, port)).toThrow()
    expect(port.values).toEqual(before)
    expect(port.writes).toEqual([])
  })

  it('compares a genuine linked domain transition including its related source record', () => {
    const changed = reviseCredential(seed, 'RN-1', '2026-09-13', 1).collection, port = storage()
    const comparison = compareCollectionSnapshot(snapshot(changed), adapter, port)
    expect(comparison.payloadChanged).toBe(true)
    expect(comparison.rows.filter(row => row.status === 'changed').length).toBeGreaterThanOrEqual(2)
    expect(comparison.rows.find(row => row.id === 'RN-1')?.status).toBe('changed')
    expect(adapter.validate(changed)).toBe(changed)
    expect(port.values.get(key)).toBe(JSON.stringify(seed))
    expect(port.writes).toEqual([])
  })

  it('detects collection history and metadata changes without inventing duplicate audit rows', () => {
    const payload = { ...seed, audit: [{ action: 'reviewed', id: 'ICU-NIGHT-14', related: [] }, { action: 'reviewed', id: 'ICU-NIGHT-14', related: [] }], reviewMetadata: { note: 'Retain collection history' } }, port = storage()
    const comparison = compareCollectionSnapshot(snapshot(payload), adapter, port)
    expect(comparison.payloadChanged).toBe(true)
    expect(comparison.rows.every(row => row.status === 'unchanged')).toBe(true)
    expect(adapter.groups(payload)).toHaveLength(2)
    expect(adapter.validate(payload)).toBe(payload)
    expect(port.writes).toEqual([])
  })

  it('exports a valid optional-field legacy read without materializing or modifying storage', () => {
    const legacyRaw = JSON.stringify({ ...initialShiftLedger, transferReviews: undefined, credentialWork: undefined })
    const port = storage([['careroster:ward-icu:night:2026-09-14:v1', legacyRaw], ['unrelated:fixture', 'retained']])
    const before = new Map(port.values)
    const raw = createCollectionSnapshot(adapter, port, '2026-09-30T12:00:00.000Z')
    expect(compareCollectionSnapshot(raw, adapter, port).payloadChanged).toBe(false)
    expect(port.values).toEqual(before)
    expect(port.values.has(key)).toBe(false)
    expect(port.writes).toEqual([])
  })
})
