import type { SnapshotAdapter } from '../../workspace/collectionSnapshot'
import { readShiftCollection } from './shiftCollection'
import type { ShiftCollection } from './shiftCollection'
import { shiftCollectionRule } from './collectionValidation'

/** The full payload retains history; only stable domain identities form comparison rows. */
export const collectionSnapshotAdapter: SnapshotAdapter<ShiftCollection> = {
  product: 'CareRoster',
  scope: 'shift-collection',
  label: 'Ward shift collection',
  read: readShiftCollection,
  validate: shiftCollectionRule,
  groups: value => [
    { key: 'shifts', label: 'Ward shifts', records: value.shifts.map(record => ({
      id: record.id, label: `${record.ward} · ${String(record.ledger.staff.length)} staff · ${record.archived ? 'Archived' : 'Active'}`, value: record,
    })) },
    { key: 'credentials', label: 'Staff credentials', records: value.credentials.map(record => ({
      id: record.id, label: `Valid through ${record.until} · ${String(record.shiftIds.length)} linked shifts`, value: record,
    })) },
  ],
}
