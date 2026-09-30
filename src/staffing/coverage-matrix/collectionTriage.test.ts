import { describe, expect, it } from 'vitest'
import { shiftTriage } from './collectionTriage'
import { seedShiftCollection } from './shiftCollection'
import { approveTransfer, changeCredential } from './shiftLedger'

describe('ward shift triage', () => {
  it('distinguishes a prepared transfer review from roster preparation', () => {
    expect(seedShiftCollection().shifts.map(shiftTriage.state)).toEqual(['roster', 'review', 'review', 'roster', 'roster'])
  })
  it('prioritizes credential recovery after a linked credential expires', () => {
    const record = seedShiftCollection().shifts[1]!
    const ledger = changeCredential(record.ledger, 'RN-1', '2026-09-13')
    expect(shiftTriage.state({ ...record, ledger })).toBe('credential')
  })
  it('searches ward and stable staff identity and uses roster revision', () => {
    const record = seedShiftCollection().shifts[2]!
    expect(shiftTriage.searchText(record)).toContain('ED ED-RN-1')
    expect(shiftTriage.revision(record)).toBe(record.ledger.revision)
  })
  it('does not present an outdated transfer approval as current', () => {
    const record = seedShiftCollection().shifts[1]!
    const approved = approveTransfer(record.ledger, 'clinical lead')
    expect(shiftTriage.state({ ...record, ledger: approved })).toBe('approved')
    const revised = changeCredential(approved, 'RN-1', '2026-12-31')
    expect(shiftTriage.state({ ...record, ledger: revised })).toBe('approval-stale')
  })
})
