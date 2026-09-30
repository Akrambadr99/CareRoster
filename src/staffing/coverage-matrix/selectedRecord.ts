import type { StoragePort } from '../../workspace/repository'
import { bindRecord } from '../../workspace/recordStorage'
import { readShiftCollection, saveShiftCollection } from './shiftCollection'
import { readShiftLedger } from './shiftLedger'

export function openSelectedRecord(storage: StoragePort, id = 'ICU-NIGHT-14') {
  return bindRecord(storage, id, {
    key: 'careroster:ward-icu:night:2026-09-14:v1',
    collectionKey: 'careroster:shift-collection:v1',
    read: readShiftCollection, save: saveShiftCollection,
    find: (collection, target) => collection.shifts.find(item => item.id === target),
    value: record => record.ledger, archived: record => record.archived,
    replace: (collection, target, raw) => {
      const value = readShiftLedger({ getItem: () => raw, setItem: () => { throw new Error('Read only decoder.') } })
      return { ...collection, shifts: collection.shifts.map(item => item.id === target ? { ...item, ledger: value } : item),
        audit: [...collection.audit, { action: 'detail-updated', id: target, related: [] }] }
    },
  })
}
