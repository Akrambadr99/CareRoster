import type { StoragePort } from '../../workspace/repository'
import { readShiftCollection } from './shiftCollection'

export function activeRecordWork(storage: StoragePort) {
  return readShiftCollection(storage).shifts.filter(item => !item.archived).map(item => ({ shiftId: item.id, ward: item.ward, ledger: item.ledger }))
}
export function selectedRecordWork(storage: StoragePort, id: string) {
  const record = activeRecordWork(storage).find(item => item.shiftId === id)
  if (!record) throw new Error('Active record not found.')
  return record
}
