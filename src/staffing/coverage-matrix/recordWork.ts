import type { StorageReader } from '../../platform/storage-port'
import { readShiftCollection } from './shiftCollection'

export function activeRecordWork(storage: StorageReader) {
  return readShiftCollection(storage).shifts.filter(item => !item.archived).map(item => ({ shiftId: item.id, ward: item.ward, ledger: item.ledger }))
}
export function selectedRecordWork(storage: StorageReader, id: string) {
  const record = activeRecordWork(storage).find(item => item.shiftId === id)
  if (!record) throw new Error('Active record not found.')
  return record
}
