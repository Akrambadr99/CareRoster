import { describe, expect, it } from 'vitest'
import { candidateAssignments } from './coverage'
import { assignStaff, changeCredential, initialShiftLedger, requestTransferReview } from './shiftLedger'
import { careActorLoad, careClaimBlockers, careWorkInbox, claimCredentialWork, claimTransferWork } from './clinicalWorkload'

function ready() {
  let state = initialShiftLedger
  for (const id of ['RN-4', 'RN-6']) {
    const candidate = candidateAssignments.find(item => item.id === id)
    if (!candidate) throw new Error('Missing roster fixture.')
    state = assignStaff(state, candidate)
  }
  return state
}

describe('multi-shift clinical workload', () => {
  it('projects credential and transfer work across shifts with qualification and stable ordering', () => {
    const transfer = requestTransferReview(ready(), 'roster coordinator')
    const expired = changeCredential(ready(), 'RN-4', '2026-09-13')
    const records = [
      { shiftId: 'ICU-NIGHT', ward: 'ICU', ledger: transfer },
      { shiftId: 'ED-NIGHT', ward: 'ED', ledger: expired },
    ]
    expect(careWorkInbox(records).map(item => item.kind)).toEqual(['credential', 'transfer'])
    expect(careClaimBlockers(records, 'ED-NIGHT', 'lead-mira', 'credential')).toContain('Wrong clinical qualification for this work.')
    const first = records[0]
    const second = records[1]
    if (!first || !second) throw new Error('Missing shift work fixtures.')
    const claimed = claimTransferWork(first, 'lead-mira', records, transfer.revision)
    expect(claimed.transferReviews?.[0]?.assigneeId).toBe('lead-mira')
    expect(careActorLoad([{ ...first, ledger: claimed }, second], 'lead-mira')).toBe(1)
  })

  it('requires the named credential specialist and clears completed exception work', () => {
    const expired = changeCredential(ready(), 'RN-4', '2026-09-13')
    const record = { shiftId: 'ICU-NIGHT', ward: 'ICU', ledger: expired }
    const claimed = claimCredentialWork(record, 'RN-4', 'cred-jo', [record])
    expect(() => changeCredential(claimed, 'RN-4', '2026-12-31', 'lead-mira')).toThrow(/another named specialist/)
    const renewed = changeCredential(claimed, 'RN-4', '2026-12-31', 'cred-jo')
    expect(renewed.credentialWork?.[0]?.status).toBe('completed')
    expect(careWorkInbox([{ ...record, ledger: renewed }])).toHaveLength(0)
  })
})
