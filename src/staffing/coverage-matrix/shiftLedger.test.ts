import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/memory-storage'
import { candidateAssignments } from './coverage'
import { approveTransfer, assignStaff, readShiftLedger, removeStaff, saveShiftLedger, transferBlockers } from './shiftLedger'
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
})
