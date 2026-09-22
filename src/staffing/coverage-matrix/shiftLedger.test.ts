import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/memory-storage'
import { candidateAssignments } from './coverage'
import { approveTransfer, assignStaff, changeCredential, readShiftLedger, removeStaff, revalidateTransfer, saveShiftLedger, transferBlockers } from './shiftLedger'
describe('shift coverage to transfer dependency', () => {
  it('uses persisted qualified assignments to close transfer blockers', () => {
    const storage = new MemoryStorage()
    let state = readShiftLedger(storage)
    expect(transferBlockers(state)).toHaveLength(1)
    for (const id of ['RN-4', 'RN-6']) {
      const candidate = candidateAssignments.find(item => item.id === id)
      if (!candidate) throw new Error('Missing test candidate.')
      state = saveShiftLedger(storage, assignStaff(state, candidate))
    }
    expect(transferBlockers(readShiftLedger(storage))).toEqual([])
  })
  it('protects the roster once transfer coverage is approved', () => {
    let state = readShiftLedger(new MemoryStorage())
    for (const id of ['RN-4', 'RN-6']) {
      const candidate = candidateAssignments.find(item => item.id === id)
      if (!candidate) throw new Error('Missing test candidate.')
      state = assignStaff(state, candidate)
    }
    state = approveTransfer(state)
    expect(() => removeStaff(state, 'RN-4')).toThrow(/depends/)
    expect(state.history.map(item => item.action)).toEqual(['assigned', 'assigned', 'transfer-approved'])
  })
  it('marks transfer approval stale on credential expiry and recovers only with qualified coverage', () => {
    let state = readShiftLedger(new MemoryStorage())
    for (const id of ['RN-4', 'RN-6']) {
      const candidate = candidateAssignments.find(item => item.id === id)
      if (!candidate) throw new Error('Missing candidate.')
      state = assignStaff(state, candidate)
    }
    state = approveTransfer(state)
    state = changeCredential(state, 'RN-4', '2026-09-13')
    expect(transferBlockers(state).join(' ')).toMatch(/uncovered.*stale/)
    expect(() => revalidateTransfer(state)).toThrow(/uncovered/)
    state = changeCredential(state, 'RN-4', '2026-12-31')
    const restored = revalidateTransfer(state)
    expect(transferBlockers(restored)).toEqual([])
    expect(restored.transferSourceRevision).toBe(restored.revision)
  })
})
