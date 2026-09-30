import { describe, expect, it } from 'vitest'
import type { StoragePort } from '../../workspace/repository'
import { saveCurrentCollection } from '../../workspace/recordStorage'
import { openSelectedRecord } from './selectedRecord'
import { readShiftCollection, saveShiftCollection } from './shiftCollection'
import { readShiftLedger, saveShiftLedger, removeStaff } from './shiftLedger'

class MemoryStorage implements StoragePort {
  data = new Map<string, string>()
  fail = false
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, raw: string) { if (this.fail) throw new Error('Storage full'); this.data.set(key, raw) }
}
const edit: (state: ReturnType<typeof readShiftLedger>) => ReturnType<typeof readShiftLedger> = state => removeStaff(state, state.staff[0]?.id ?? '')
const key = 'careroster:ward-icu:night:2026-09-14:v1'
describe('selected shift persistence', () => {
  it('preserves the primary migration source when a secondary record opens first', () => {
    const storage = new MemoryStorage()
    const before = readShiftCollection(storage)
    const peer = before.shifts[1]
    if (!peer) throw new Error('Secondary fixture missing')
    const bound = openSelectedRecord(storage, peer.id)
    expect(readShiftCollection(bound)).toEqual(before)
    expect(storage.data.size).toBe(0)
  })
  it('imports legacy history once and retains its original backup', () => {
    const storage = new MemoryStorage()
    const legacy = edit(readShiftLedger(storage))
    saveShiftLedger(storage, legacy)
    const backup = storage.getItem(key)
    const bound = openSelectedRecord(storage)
    expect(readShiftLedger(bound)).toEqual(legacy)
    saveShiftLedger(bound, legacy)
    expect(readShiftCollection(storage).shifts[0]?.ledger).toEqual(legacy)
    expect(storage.getItem(key)).toBe(backup)
    saveShiftLedger(storage, readShiftLedger(new MemoryStorage()))
    expect(readShiftLedger(openSelectedRecord(storage))).toEqual(legacy)
  })
  it('persists a domain action and preserves every unrelated record', () => {
    const storage = new MemoryStorage(), before = readShiftCollection(storage)
    const bound = openSelectedRecord(storage), changed = edit(readShiftLedger(bound))
    saveShiftLedger(bound, changed)
    const after = readShiftCollection(storage)
    expect(after.shifts[0]?.ledger).toEqual(changed)
    expect(after.shifts.slice(1)).toEqual(before.shifts.slice(1))
    expect(readShiftLedger(openSelectedRecord(storage))).toEqual(changed)
    expect(after.audit.at(-1)).toMatchObject({ action: 'detail-updated', id: 'ICU-NIGHT-14' })
  })
  it('rejects stale edits without replacing the newer domain state', () => {
    const storage = new MemoryStorage()
    const first = openSelectedRecord(storage), stale = openSelectedRecord(storage)
    const changed = edit(readShiftLedger(first))
    saveShiftLedger(first, changed)
    expect(() => saveShiftLedger(stale, edit(readShiftLedger(stale)))).toThrow('changed in another view')
    expect(readShiftLedger(openSelectedRecord(storage))).toEqual(changed)
  })
  it('merges with an unrelated record archive without losing that edit', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const before = readShiftCollection(storage), peer = before.shifts[1]
    if (!peer) throw new Error('Peer fixture missing')
    const newer = { ...before, shifts: before.shifts.map(item => item.id === peer.id ? { ...item, archived: true } : item) }
    saveShiftCollection(storage, newer)
    saveShiftLedger(bound, edit(readShiftLedger(bound)))
    expect(readShiftCollection(storage).shifts[1]).toEqual(newer.shifts[1])
  })
  it('rejects missing and archived targets without writing', () => {
    const storage = new MemoryStorage()
    expect(() => openSelectedRecord(storage, 'missing')).toThrow('not found')
    expect(storage.data.size).toBe(0)
    const before = readShiftCollection(storage)
    saveShiftCollection(storage, { ...before, shifts: before.shifts.map(item => ({ ...item, archived: true })) })
    const snapshot = [...storage.data]
    expect(() => openSelectedRecord(storage)).toThrow('archived')
    expect([...storage.data]).toEqual(snapshot)
  })
  it('rejects a record archived after the editor opened', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const before = readShiftCollection(storage)
    saveShiftCollection(storage, { ...before, shifts: before.shifts.map(item => ({ ...item, archived: true })) })
    expect(() => saveShiftLedger(bound, edit(readShiftLedger(bound)))).toThrow('changed in another view')
  })
  it('preserves retryability after a recoverable storage failure', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const changed = edit(readShiftLedger(bound))
    storage.fail = true
    expect(() => saveShiftLedger(bound, changed)).toThrow('Browser storage rejected the save')
    storage.fail = false
    saveShiftLedger(bound, changed)
    expect(readShiftLedger(openSelectedRecord(storage))).toEqual(changed)
  })
  it('protects a detail edit against a stale whole-workspace save', () => {
    const storage = new MemoryStorage(), stale = readShiftCollection(storage)
    const bound = openSelectedRecord(storage)
    saveShiftLedger(bound, edit(readShiftLedger(bound)))
    expect(() => saveCurrentCollection(storage, stale, stale, readShiftCollection, saveShiftCollection)).toThrow('Workspace changed')
    expect(readShiftCollection(storage).shifts[0]?.ledger).not.toEqual(stale.shifts[0]?.ledger)
  })
})
