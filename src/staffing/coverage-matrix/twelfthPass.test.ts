import { describe, expect, it } from 'vitest'
import { assignStaff, changeCredential, clinicalInbox, initialShiftLedger, requestTransferReview } from './shiftLedger'
import { candidateAssignments } from './coverage'

describe('clinical transfer responsibility', () => {
  it('makes a roster change stale and preserves a replacement chain', () => {
    let state = initialShiftLedger
    expect(() => requestTransferReview(state, 'roster coordinator')).toThrow(/uncovered/)
    for (const id of ['RN-4', 'RN-6']) {
      const candidate = candidateAssignments.find(item => item.id === id)
      if (!candidate) throw new Error('Missing coverage fixture.')
      state = assignStaff(state, candidate)
    }
    state = requestTransferReview(state, 'roster coordinator')
    expect(clinicalInbox(state, 'clinical lead')).toHaveLength(1)
    const person = state.staff[0]
    if (!person) throw new Error('Missing roster fixture.')
    state = changeCredential(state, person.id, person.credentialUntil)
    expect(clinicalInbox(state, 'clinical lead')).toHaveLength(0)
    expect(state.transferReviews?.[0]?.status).toBe('stale')
    state = requestTransferReview(state, 'roster coordinator')
    expect(state.transferReviews?.map(item => item.status)).toEqual(['superseded', 'open'])
  })
})
