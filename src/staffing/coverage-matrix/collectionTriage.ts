import type { ExplorerPolicy } from '../../workspace/collectionExplorer'
import type { ShiftRecord } from './shiftCollection'

// Credential and stale-review work must remain visible before transfer readiness.
export const shiftTriage: ExplorerPolicy<ShiftRecord> = {
  searchText: record => [record.id, record.ward, ...record.ledger.staff.map(item => item.id),
    ...(record.ledger.transferReviews ?? []).filter(item => item.status === 'open').map(item => item.assigneeId ?? '')].join(' '),
  revision: record => record.ledger.revision,
  state: record => {
    const { ledger } = record
    if (ledger.credentialWork?.some(item => item.status === 'open')) return 'credential'
    if (ledger.transferApproved && ledger.transferSourceRevision !== ledger.revision) return 'approval-stale'
    if (ledger.transferReviews?.some(item => item.status === 'stale')) return 'stale'
    if (ledger.transferReviews?.some(item => item.status === 'open')) return 'review'
    return ledger.transferApproved ? 'approved' : 'roster'
  },
  states: [
    { value: 'credential', label: 'Credential work open' },
    { value: 'approval-stale', label: 'Transfer approval needs revalidation' },
    { value: 'stale', label: 'Stale transfer review' },
    { value: 'review', label: 'Transfer review open' },
    { value: 'approved', label: 'Transfer approved' },
    { value: 'roster', label: 'Roster preparation' },
  ],
}
